"""
Limites de criação de link.

Criar é a única escrita aberta a quem não tem conta, então é por ali que um
robô encheria o banco — e cada link criado gera também um PNG de QR Code no
disco. O teto é por IP para quem não entrou e por conta para quem entrou, com
folga bem maior no segundo caso: ali existe alguém identificável do outro lado.
"""

from rest_framework.settings import api_settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class SettingsRateMixin:
    """
    Taxa lida do settings a cada requisição.

    O DRF copia `DEFAULT_THROTTLE_RATES` para um atributo de classe no momento
    do import, e a referência fica presa ao dicionário daquele instante. Lendo
    de `api_settings` na hora, quem manda é sempre a configuração em vigor —
    que é o comportamento esperado de qualquer outro ajuste do arquivo.
    """

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES[self.scope]  # type: ignore[attr-defined]


class AnonLinkCreateThrottle(SettingsRateMixin, AnonRateThrottle):
    """Encurtador público da home, contado por IP."""

    scope = "link-create-anon"


class UserLinkCreateThrottle(SettingsRateMixin, UserRateThrottle):
    """Criação com sessão, contada por conta."""

    scope = "link-create-user"

    def allow_request(self, request, view):
        # O UserRateThrottle cai no IP quando não há sessão; sem isto, quem não
        # entrou seria contado duas vezes, aqui e no limite dos anônimos.
        if not request.user or not request.user.is_authenticated:
            return True

        return super().allow_request(request, view)
