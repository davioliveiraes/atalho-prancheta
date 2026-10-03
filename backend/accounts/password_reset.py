"""
Redefinição de senha por e-mail.

Duas metades, uma por endpoint:

    - Pedir: quem esqueceu informa o e-mail e, se houver conta, recebe um link.
    - Confirmar: o link traz `uid` e `token`; com eles e a senha nova, a troca
      acontece e todas as sessões abertas da conta caem.

O token é o `PasswordResetTokenGenerator` do Django, sem tabela nenhuma: é um
HMAC sobre a conta, a hora do pedido, o hash da senha atual e o último login.
Trocar a senha muda o hash, então o link vale uma vez só; e passa a valer nada
depois de `PASSWORD_RESET_TIMEOUT`.

O link leva `uid` e `token` depois do `#`, e não no caminho nem na query. O
fragmento não sai do navegador: não chega ao nginx — e portanto não fica no
log de acesso da VPS — nem vai no cabeçalho Referer para lugar nenhum.
"""

import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

User = get_user_model()

logger = logging.getLogger(__name__)

# Um e-mail por endereço a cada intervalo, venha o pedido de onde vier. O teto
# do DRF é por IP, e não impede que vários IPs mirem a mesma caixa de entrada.
EMAIL_INTERVAL = timedelta(minutes=2)

# Tela da interface que recebe o link. Está em `shortener/reserved.py`.
RESET_PATH = "/redefinir-senha"

INVALID_LINK_MESSAGE = (
    "Este link de redefinição é inválido ou já expirou. Peça um novo e use o mais recente."
)


def valid_minutes():
    """Por quanto tempo o link vale, como o e-mail e a resposta da API dizem."""
    return settings.PASSWORD_RESET_TIMEOUT // 60


def request_message():
    """
    A resposta do pedido — a mesma com e sem conta.

    Dizer "não achamos este e-mail" entregaria quem tem conta aqui a qualquer
    um com uma lista de endereços.
    """
    return (
        "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. "
        f"Ele vale por {valid_minutes()} minutos."
    )


def encode_uid(user):
    return urlsafe_base64_encode(force_bytes(user.pk))


def user_from_uid(uid):
    """A conta do `uid` do link, ou None — inclusive para `uid` que nem decodifica."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        return User.objects.get(pk=pk, is_active=True)
    except TypeError, ValueError, OverflowError, User.DoesNotExist:
        return None


def reset_link(user):
    """`https://dominio/redefinir-senha#uid=…&token=…` — ver o docstring do módulo."""
    token = default_token_generator.make_token(user)
    return f"{settings.SITE_URL}{RESET_PATH}#uid={encode_uid(user)}&token={token}"


def _send(subject, body, recipient):
    """O envio em si, que pode rodar fora da requisição e por isso não levanta."""
    try:
        send_mail(subject, body, None, [recipient])
    except Exception:  # pylint: disable=broad-exception-caught
        # Numa thread, a exceção não teria para onde subir: morreria calada e
        # quem pediu ficaria esperando um e-mail que nunca sai. O log é o único
        # lugar onde alguém vai ver que o SMTP recusou.
        logger.exception("Falha ao enviar o e-mail de redefinição de senha")


def send_reset_email(user):
    """
    Monta a mensagem aqui, na requisição, e só despacha o envio.

    O token e o link são calculados antes da thread para que ela não precise do
    banco: uma conexão aberta numa thread solta é uma conexão que ninguém fecha.
    """
    context = {
        "name": user.first_name,
        "email": user.email,
        "link": reset_link(user),
        "minutes": valid_minutes(),
    }
    subject = render_to_string("accounts/password_reset_subject.txt", context).strip()
    body = render_to_string("accounts/password_reset_email.txt", context)

    if settings.PASSWORD_RESET_EMAIL_IN_BACKGROUND:
        threading.Thread(target=_send, args=(subject, body, user.email), daemon=True).start()
    else:
        _send(subject, body, user.email)


def request_reset(email):
    """
    Manda o link se houver conta ativa com o e-mail. Não diz se mandou.

    Conta sem senha utilizável fica de fora, como no formulário do próprio
    Django: é uma conta em que alguém decidiu que não se entra por senha, e um
    e-mail não deveria desfazer essa decisão.
    """
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None or not user.has_usable_password():
        return

    # `add` só grava se a chave não existe: é o "manda se não mandou há pouco"
    # em uma operação só, sem corrida entre dois pedidos simultâneos.
    if not cache.add(f"senha:pedido:{user.pk}", 1, timeout=EMAIL_INTERVAL.total_seconds()):
        return

    send_reset_email(user)


def revoke_sessions(user):
    """
    Derruba todas as sessões da conta.

    Quem redefine a senha pode estar fazendo isso justamente porque alguém
    entrou na conta. Cada refresh emitido vai para a blacklist; o access de quem
    já estava dentro ainda vale até expirar — no máximo `JWT_ACCESS_MINUTES` —,
    e depois disso a renovação é recusada.
    """
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)
