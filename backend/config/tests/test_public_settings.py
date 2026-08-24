"""
O que a interface lê antes de desenhar o formulário de link.
"""

from django.test import TestCase, override_settings
from django.urls import reverse


class PublicSettingsTest(TestCase):
    def get(self):
        return self.client.get(reverse("public-settings"))

    @override_settings(SHORTLINK_BASE_DOMAIN="atalho.app")
    def test_reports_the_configured_domain(self):
        self.assertEqual(self.get().json(), {"shortlink_base_domain": "atalho.app"})

    @override_settings(SHORTLINK_BASE_DOMAIN="")
    def test_reports_null_when_the_feature_is_off(self):
        """A tela usa a ausência para não oferecer um campo que não funcionaria."""
        self.assertEqual(self.get().json(), {"shortlink_base_domain": None})

    @override_settings(SHORTLINK_BASE_DOMAIN="atalho.app")
    def test_answers_without_an_account(self):
        """O encurtador da home também pergunta, e lá ninguém está autenticado."""
        response = self.get()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
