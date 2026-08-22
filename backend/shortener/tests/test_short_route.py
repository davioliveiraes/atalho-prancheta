"""
O link curto na raiz: `/{codigo}`.

A rota antiga, `/api/r/{codigo}/`, continua respondendo — os links já
divulgados e os QR Codes já impressos apontam para ela.
"""

import tempfile

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import Click, ShortenedURL
from shortener.reserved import RESERVED_CODES, is_reserved

User = get_user_model()


class ShortRouteTest(TestCase):
    def setUp(self):
        self.link = ShortenedURL.objects.create(
            original_url="https://destino.exemplo.com", short_code="abc123"
        )

    def test_the_code_answers_at_the_root(self):
        response = self.client.get("/abc123")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "https://destino.exemplo.com")  # type: ignore

    def test_the_trailing_slash_is_optional(self):
        """Um encurtador não pode gastar um 301 de correção em cada acesso."""
        response = self.client.get("/abc123/")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "https://destino.exemplo.com")  # type: ignore

    def test_the_root_route_counts_the_click(self):
        self.client.get("/abc123", REMOTE_ADDR="203.0.113.10")

        self.link.refresh_from_db()
        self.assertEqual(self.link.total_clicks, 1)
        self.assertEqual(self.link.unique_clicks, 1)
        self.assertEqual(Click.objects.filter(url=self.link).count(), 1)

    def test_the_old_address_still_works(self):
        response = self.client.get("/api/r/abc123/")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "https://destino.exemplo.com")  # type: ignore

    def test_an_unknown_code_answers_404_at_the_root(self):
        response = self.client.get("/naoexiste")

        self.assertEqual(response.status_code, 404)

    def test_a_blocked_link_answers_403_at_the_root(self):
        self.link.is_active = False
        self.link.save()

        response = self.client.get("/abc123")

        self.assertEqual(response.status_code, 403)

    def test_the_pattern_does_not_swallow_the_application(self):
        """
        A raiz é dividida com as telas. O que tem outro formato — mais de um
        segmento, ponto, hífen — nem chega ao redirecionamento.
        """
        for path in ["/painel/fichas", "/links/abc123", "/api/urls/", "/favicon.ico"]:
            with self.subTest(caminho=path):
                response = self.client.get(path)
                # Qualquer coisa menos o 403/302 de um link, e menos a página de
                # código não encontrado do redirecionamento.
                self.assertNotIn(response.status_code, [302, 403])


class ReservedCodeTest(APITestCase):
    def setUp(self):
        media = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=media))
        self.list_url = reverse("shortened-url-list")

    def test_is_reserved_ignores_case(self):
        self.assertTrue(is_reserved("painel"))
        self.assertTrue(is_reserved("PAINEL"))
        self.assertTrue(is_reserved("Painel"))
        self.assertFalse(is_reserved("painelx"))

    def test_a_reserved_code_is_refused(self):
        for code in ["painel", "links", "entrar", "api", "admin"]:
            with self.subTest(codigo=code):
                response = self.client.post(
                    self.list_url,
                    {"original_url": "https://exemplo.com", "short_code": code},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("short_code", response.data)  # type: ignore

    def test_a_code_that_merely_starts_with_a_reserved_word_is_fine(self):
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "short_code": "painelx"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_every_reserved_word_that_could_be_a_code_is_refused(self):
        """
        `criar-conta` tem hífen e já morreria na validação de formato; os
        outros passariam por ela e precisam desta lista.
        """
        for code in RESERVED_CODES:
            if not code.isalnum() or len(code) < 3:
                continue
            with self.subTest(codigo=code):
                response = self.client.post(
                    self.list_url,
                    {"original_url": "https://exemplo.com", "short_code": code},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_created_link_advertises_the_short_address(self):
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "short_code": "curto1"},
            format="json",
        )

        short_url = response.data["short_url"]  # type: ignore
        self.assertTrue(short_url.endswith("/curto1"), short_url)
        self.assertNotIn("/api/r/", short_url)
