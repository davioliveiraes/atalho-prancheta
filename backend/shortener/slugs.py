"""
As regras de um apelido de link.

O mesmo texto responde nos dois endereços — `atalho.app/loja-natal` e
`loja-natal.atalho.app` — então ele precisa ser válido nos dois mundos ao mesmo
tempo: caminho de URL e rótulo de DNS. O denominador comum é o que está escrito
aqui.

Dois campos usam estas regras, com uma diferença só:

    - `short_code` é o caminho. Diferencia maiúsculas de minúsculas, porque os
      códigos sorteados sempre diferenciaram — `aB3xY9` e `ab3xy9` são dois
      links — e mudar isso agora quebraria endereço já divulgado.
    - `subdomain` é o rótulo DNS. O navegador entrega o Host em minúsculas e
      não há como distinguir `Loja` de `loja`, então o campo guarda o texto já
      normalizado e a comparação é sempre sobre ele.

`SLUG_REGEX` é copiado em três lugares que decidem o roteamento antes de
qualquer código Python rodar — os mesmos de `reserved.py`:

    - config/urls.py                      (a rota da raiz)
    - deploy/nginx/default.conf.template  (produção)
    - frontend/vite.config.ts             (desenvolvimento)
"""

import re

from django.core.exceptions import ValidationError

from .reserved import is_reserved, reserved_alternation

MIN_LENGTH = 3

# 32 cabe `grupowhatsempresa` com folga e ainda fica longe do teto de 63 de um
# rótulo DNS, que é o limite real do lado do subdomínio.
MAX_LENGTH = 32

# Letras, números e hífen; nunca começando nem terminando em hífen. Escrito com
# os limites explícitos para poder ser colado num arquivo de nginx, que não tem
# como consultar MIN_LENGTH nem MAX_LENGTH.
SLUG_REGEX = r"[A-Za-z0-9](?:[A-Za-z0-9-]{1,30}[A-Za-z0-9])?"

SLUG_PATTERN = re.compile(rf"^{SLUG_REGEX}$")


def normalize_subdomain(value):
    """Minúsculas e sem espaço em volta — a forma em que o campo é gravado."""
    return (value or "").strip().lower()


def validate_slug(value):
    """
    Valida um apelido. Levanta o ValidationError do Django, e não o do DRF, para
    servir tanto ao campo do modelo (admin) quanto aos campos do serializador.
    """
    if len(value) < MIN_LENGTH:
        raise ValidationError(f"Deve ter no minimo {MIN_LENGTH} caracteres.")

    if len(value) > MAX_LENGTH:
        raise ValidationError(f"Deve ter no maximo {MAX_LENGTH} caracteres.")

    if not SLUG_PATTERN.match(value):
        raise ValidationError(
            "Use apenas letras sem acento, numeros e hifen, sem comecar nem terminar em hifen."
        )

    # `xn--` é o prefixo que o DNS reserva para nome internacionalizado. Recusar
    # o hífen duplo inteiro é mais simples de explicar do que a regra exata, e
    # ninguém perde nada: `loja--natal` não é um apelido que alguém queira.
    if "--" in value:
        raise ValidationError("Nao use dois hifens seguidos.")

    if is_reserved(value):
        raise ValidationError("Este nome e reservado pela aplicacao. Escolha outro.")

    return value


def shortlink_path_regex():
    """
    O padrão da rota da raiz: um apelido que não seja nome reservado.

    A exclusão exige o nome inteiro — `/painel` é tela, mas `/painelx` é um
    apelido legítimo. É este texto que as cópias do nginx e do Vite reproduzem.
    """
    return rf"(?!(?:{reserved_alternation()})/?$){SLUG_REGEX}"
