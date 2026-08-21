"""
Funções auxiliares para aplicativos de encurtamento de URLs.

Este módulo fornece funções auxiliares para geração de código QR e extração de IP.

"""

import ipaddress
import random
import string
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile

import qrcode


def generate_short_code(length=6):
    characters = string.ascii_letters + string.digits
    return "".join(random.choice(characters) for _ in range(length))


def generate_qr_code(url, short_code):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,  # type: ignore
        box_size=10,
        border=4,
    )

    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer, format="PNG")  # type: ignore
    buffer.seek(0)

    return ContentFile(buffer.read(), name=f"{short_code}.png")


# Devolvido quando nao ha nenhum IP aproveitavel na requisicao. Click.ip_address e
# NOT NULL, entao a gravacao do clique precisa de um valor valido de qualquer forma.
UNKNOWN_IP = "0.0.0.0"


def _clean_ip(value):
    """
    Normaliza uma entrada de cabecalho e devolve None se nao for um IP valido.

    Aceita as formas que proxies costumam emitir: "1.2.3.4", "1.2.3.4:5678",
    "[::1]:443" e "::1". A normalizacao importa para a contagem de cliques unicos,
    que compara o IP por igualdade textual — sem ela "::1" e "0:0:0:0:0:0:0:1"
    contariam como dois visitantes diferentes.
    """
    candidate = (value or "").strip()
    if not candidate:
        return None

    if candidate.startswith("["):
        # IPv6 entre colchetes, com ou sem porta: "[::1]" ou "[::1]:443".
        candidate = candidate.partition("]")[0].lstrip("[")
    elif candidate.count(":") == 1:
        # Um unico ":" so pode ser IPv4 com porta — IPv6 sempre tem mais de um.
        candidate = candidate.split(":", 1)[0]

    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def get_client_ip(request):
    """
    IP do visitante, lendo X-Forwarded-For apenas quando ha proxy confiavel.

    O cabecalho e controlado pelo cliente: em acesso direto qualquer um poderia
    enviar um X-Forwarded-For inventado a cada visita e ser contado como um
    visitante novo, inflando unique_clicks e furando o teto de max_clicks. Por isso
    ele so e considerado quando settings.TRUSTED_PROXY_COUNT > 0, e a leitura e
    feita da direita para a esquerda, pulando as entradas que os proxies
    confiaveis acrescentaram.
    """
    remote_addr = _clean_ip(request.META.get("REMOTE_ADDR"))
    trusted_proxies = getattr(settings, "TRUSTED_PROXY_COUNT", 0)

    if trusted_proxies < 1:
        return remote_addr or UNKNOWN_IP

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR") or ""
    hops = [hop for hop in (part.strip() for part in forwarded.split(",")) if hop]

    # Cadeia menor que o esperado significa proxy mal configurado ou requisicao que
    # nao passou por ele. Confiar no que veio ali seria aceitar valor forjado.
    if len(hops) < trusted_proxies:
        return remote_addr or UNKNOWN_IP

    return _clean_ip(hops[-trusted_proxies]) or remote_addr or UNKNOWN_IP
