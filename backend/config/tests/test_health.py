from django.test import TestCase
from django.urls import reverse


class HealthTest(TestCase):
    """
    O healthcheck do Compose bate aqui.

    Antes ele perguntava por /api/urls/, que passou a responder 401 a quem nao
    tem conta — e o container aparecia como doente estando de pe.
    """

    def test_health_answers_without_an_account(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_health_is_json(self):
        response = self.client.get(reverse("health"))
        self.assertEqual(response["Content-Type"], "application/json")
