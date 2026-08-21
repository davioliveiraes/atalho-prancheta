"""
Teto de criação de link.

Criar é a única escrita aberta a quem não tem conta, e cada link criado grava
também um PNG no disco. As taxas reais vêm do ambiente; aqui elas são apertadas
para caber no teste.
"""

import tempfile

from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import ShortenedURL

User = get_user_model()


def with_rates(**overrides):
    """
    REST_FRAMEWORK com as taxas trocadas.

    O `override_settings` substitui o dicionário inteiro, então o resto da
    configuração do DRF precisa ser copiado junto.
    """
    changed = dict(django_settings.REST_FRAMEWORK)
    changed["DEFAULT_THROTTLE_RATES"] = {
        **changed["DEFAULT_THROTTLE_RATES"],
        **overrides,
    }
    return changed


class LinkCreateThrottleTest(APITestCase):
    def setUp(self):
        # O histórico do throttle mora no cache e sobrevive entre os testes.
        cache.clear()
        # Sem isto cada link criado deixaria um QR Code no diretório de mídia.
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=media))

        self.list_url = reverse("shortened-url-list")

    def shorten(self, url="https://exemplo.com/pagina"):
        return self.client.post(self.list_url, {"original_url": url}, format="json")

    @override_settings(REST_FRAMEWORK=with_rates(**{"link-create-anon": "2/hour"}))
    def test_anonymous_creation_stops_at_the_ceiling(self):
        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)

        blocked = self.shorten()
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(ShortenedURL.objects.count(), 2)

    @override_settings(REST_FRAMEWORK=with_rates(**{"link-create-anon": "1/hour"}))
    def test_the_ceiling_does_not_reach_the_reading_routes(self):
        created = self.shorten()
        code = created.data["short_code"]  # type: ignore
        self.assertEqual(self.shorten().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        detail = self.client.get(reverse("shortened-url-detail", kwargs={"short_code": code}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

        redirected = self.client.get(f"/api/r/{code}/")
        self.assertEqual(redirected.status_code, 302)

    @override_settings(
        REST_FRAMEWORK=with_rates(**{"link-create-anon": "1/hour", "link-create-user": "10/hour"})
    )
    def test_the_anonymous_ceiling_does_not_reach_an_account(self):
        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.shorten().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        davi = User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")
        self.client.force_authenticate(davi)

        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)

    @override_settings(REST_FRAMEWORK=with_rates(**{"link-create-user": "1/hour"}))
    def test_an_account_has_its_own_ceiling(self):
        davi = User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")
        self.client.force_authenticate(davi)

        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.shorten().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(REST_FRAMEWORK=with_rates(**{"link-create-user": "1/hour"}))
    def test_two_accounts_do_not_share_the_ceiling(self):
        davi = User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")
        outra = User.objects.create_user(username="outra@exemplo.com", email="outra@exemplo.com")

        self.client.force_authenticate(davi)
        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(outra)
        self.assertEqual(self.shorten().status_code, status.HTTP_201_CREATED)
