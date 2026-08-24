"""
As regras do destino de um link — a URL para onde o atalho manda.

O destino é a única parte do link que o dono troca depois de divulgado: o
`chat.whatsapp.com/...` do grupo lotado vira o do grupo novo e o endereço curto
segue o mesmo. Por isso a validação mora aqui e não dentro de um serializador —
criação e edição precisam aplicar exatamente as mesmas regras.

Três coisas acontecem com o que o usuário digita:

    - Sem esquema, ganha `https://`. Quem cola um link do navegador cola
      `chat.whatsapp.com/L1k8...` tanto quanto `https://chat.whatsapp.com/...`.
    - Só `http` e `https` passam. O URLField do Django aceita `ftp` e `ftps` por
      padrão, e um redirecionamento para ftp não é o que este serviço faz.
    - O que vem depois do `?` fica intacto. Parâmetros de campanha (`utm_source`
      e companhia) são metade do motivo de encurtar um link.
"""

from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from rest_framework import serializers

from .addresses import base_hostname
from .reserved import is_reserved
from .slugs import SLUG_PATTERN

ALLOWED_SCHEMES = ("http", "https")

# Mesmo teto do campo do modelo (ShortenedURL.original_url).
MAX_DESTINATION_LENGTH = 2048

_validate_url_format = URLValidator(
    schemes=list(ALLOWED_SCHEMES),
    message="Informe uma URL valida, comecando com http:// ou https://.",
)


def normalize_destination(value):
    """Completa o esquema quando ele falta e tira o espaço em volta."""
    destination = (value or "").strip()
    if not destination:
        return destination

    # `//exemplo.com` é o formato relativo ao esquema; o `//` sozinho não diz
    # http nem https, então some junto.
    if destination.startswith("//"):
        destination = destination[2:]

    if "://" not in destination:
        destination = f"https://{destination}"

    return destination


def points_to_a_shortlink(value):
    """
    Diz se o destino é um link deste mesmo serviço.

    Apontar um atalho para outro atalho monta uma volta que o navegador percorre
    até desistir — e o dono do link não vê nada além de uma página de erro. Só
    o formato de link é recusado: `atalho.app/como-usar` é uma tela e continua
    sendo um destino legítimo.
    """
    base = base_hostname()
    if not base:
        return False

    parts = urlsplit(value)
    host = (parts.hostname or "").lower()

    if host.endswith(f".{base}"):
        return True

    if host != base:
        return False

    first_segment = parts.path.lstrip("/").split("/")[0]
    return (
        bool(first_segment)
        and bool(SLUG_PATTERN.match(first_segment))
        and not is_reserved(first_segment)
    )


def validate_destination(value):
    """Formato, esquema e ausência de volta. Levanta o ValidationError do Django."""
    _validate_url_format(value)

    if points_to_a_shortlink(value):
        raise ValidationError(
            "O destino nao pode ser um link deste mesmo servico — o acesso ficaria em volta."
        )

    return value


class DestinationURLField(serializers.CharField):
    """
    O campo `original_url` dos serializadores.

    Não é um `URLField` do DRF porque ele valida antes de qualquer normalização,
    e aí `chat.whatsapp.com/L1k8...` seria recusado sem nunca ganhar o `https://`
    que faltava.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", MAX_DESTINATION_LENGTH)
        kwargs.setdefault("label", "URL de destino")
        super().__init__(**kwargs)
        self.validators.append(validate_destination)

    def to_internal_value(self, data):
        return normalize_destination(super().to_internal_value(data))
