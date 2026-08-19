"""
Funções auxiliares para aplicativos de encurtamento de URLs.

Este módulo fornece funções auxiliares para geração de código QR e extração de IP.

"""

import random
import string
from io import BytesIO

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


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0]
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip
