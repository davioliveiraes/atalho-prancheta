"""
O que a interface precisa saber sobre esta instalação.

Só uma coisa, por enquanto: se o link por subdomínio está ligado, e sob qual
domínio. A tela não tem como adivinhar — `SHORTLINK_BASE_DOMAIN` vazio desliga
o middleware, e oferecer o campo assim deixaria o dono escolher um subdomínio
que ninguém atende.

Público de propósito: não conta nada que já não esteja na barra de endereços de
quem abriu a página, e o encurtador da home também precisa da resposta.
"""

from django.http import JsonResponse

from shortener.addresses import base_domain


def public_settings(_request):
    """
    `{"shortlink_base_domain": "atalho.app"}`, ou `null` com a chave vazia.

    `null` e não `""` porque a interface trata a ausência como "não ofereça o
    campo", e string vazia em JSON convida a um `if` que erra.
    """
    return JsonResponse({"shortlink_base_domain": base_domain() or None})
