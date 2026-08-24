"""
A resolução de um link: do apelido recebido até a resposta do navegador.

Dois caminhos chegam aqui e daqui para a frente são o mesmo:

    - `atalho.app/loja-natal`  — a rota da raiz, em `config/urls.py`.
    - `loja-natal.atalho.app`  — o middleware de `middleware.py`, que lê o Host
      antes de o Django resolver a URL.

Os dois contam o mesmo clique, respeitam os mesmos bloqueios e devolvem as
mesmas páginas quando o link não pode ser acessado.
"""

from django.conf import settings
from django.db.models import F
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.utils.cache import add_never_cache_headers

from .models import Click, ShortenedURL
from .utils import get_client_ip

# Cópia das quatro páginas públicas de bloqueio (1g). O destino nunca aparece.
BLOCKED_PAGES = {
    "inactive": {
        "title": "Link inativo",
        "message": (
            "Este link foi desativado por quem o criou. O destino não é revelado e o "
            "acesso não entra na contagem de cliques."
        ),
        "primary_label": "Encurtar meu próprio link",
    },
    "expired": {
        "title": "Link expirado",
        "message": (
            "A data de expiração definida na criação já passou. O link continua no "
            "painel de quem o criou, com o histórico de cliques preservado."
        ),
        "primary_label": "Encurtar meu próprio link",
    },
    "max_clicks": {
        "title": "Limite de cliques atingido",
        "message": "O link aceitava um número máximo de visitantes únicos e esse teto foi alcançado.",
        "primary_label": "Encurtar meu próprio link",
    },
    "not_found": {
        "title": "Código não encontrado",
        "message": (
            "O código informado não corresponde a nenhuma URL cadastrada. Confira se "
            "ele foi copiado por inteiro — códigos diferenciam maiúsculas de "
            "minúsculas."
        ),
        "primary_label": "Ir para o encurtador",
    },
}


class TemporaryRedirect(HttpResponseRedirect):
    """
    307, para quem configurar `SHORTLINK_REDIRECT_STATUS=307`.

    A diferença para o 302 é o método: o 307 obriga o navegador a repetir a
    requisição como ela veio, enquanto o 302 permite virar GET. Para um link
    divulgado — sempre um GET — os dois se comportam igual.
    """

    status_code = 307


def _wants_html(request):
    """Navegador recebe a página; cliente de API continua recebendo JSON."""
    return "text/html" in request.headers.get("Accept", "")


def blocked_response(request, kind, short_code, http_status, url=None):
    """
    Resposta de bloqueio com o status HTTP real — nunca 200 com página de erro.
    O template só recebe dado público: nada de original_url.
    """
    context = {
        **BLOCKED_PAGES[kind],
        "kind": kind,
        "http_status": http_status,
        "short_code": short_code,
        "home_url": request.build_absolute_uri("/"),
    }

    if url is not None:
        context["expires_at"] = url.expires_at
        context["unique_clicks"] = url.unique_clicks
        context["max_clicks"] = url.max_clicks

    if _wants_html(request):
        return render(request, "shortener/blocked.html", context, status=http_status)

    return JsonResponse(
        {"error": context["title"], "short_code": short_code},
        status=http_status,
    )


def register_click(request, url):
    """
    Grava o clique e atualiza os contadores no banco, sem passar pelo Python.

    O UPDATE com F() em vez de `instance.save()` porque dois acessos simultâneos
    ao mesmo link leriam o mesmo total e gravariam o mesmo número — um clique
    sumiria.
    """
    ip_address = get_client_ip(request)
    is_unique = not Click.objects.filter(url=url, ip_address=ip_address).exists()

    Click.objects.create(
        url=url,
        ip_address=ip_address,
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        referer=request.META.get("HTTP_REFERER", ""),
    )

    counters = {"total_clicks": F("total_clicks") + 1}
    if is_unique:
        counters["unique_clicks"] = F("unique_clicks") + 1

    ShortenedURL.objects.filter(pk=url.pk).update(**counters)


def redirect_response(destination):
    """
    O desvio em si — temporário e sem cache, nunca 301.

    O destino de um link muda: é o dono trocando o grupo de WhatsApp lotado pelo
    novo sem reimprimir nada. Um 301 ficaria guardado no navegador de quem já
    clicou uma vez, e essa pessoa continuaria caindo no destino antigo sem nem
    consultar o servidor. Os cabeçalhos de `add_never_cache_headers` fecham a
    mesma porta para o 302, que alguns navegadores também guardam.
    """
    status_code = getattr(settings, "SHORTLINK_REDIRECT_STATUS", 302)
    response_class = TemporaryRedirect if status_code == 307 else HttpResponseRedirect

    response = response_class(destination)
    add_never_cache_headers(response)
    return response


def serve_link(request, url, label):
    """
    O acesso a um link já encontrado: bloqueio, clique e desvio.

    `label` é o apelido pelo qual se chegou aqui — o código ou o subdomínio —, e
    só serve para a página de bloqueio dizer qual endereço foi acessado.
    """
    can_access, _message = url.can_be_accessed()

    if not can_access:
        # Mesma precedência de can_be_accessed().
        if not url.is_active:
            kind = "inactive"
        elif url.is_expired():
            kind = "expired"
        else:
            kind = "max_clicks"
        return blocked_response(request, kind, label, 403, url=url)

    register_click(request, url)

    return redirect_response(url.original_url)
