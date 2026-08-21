"""
Quem enxerga e quem altera cada link.

Três situações no cenário: link da conta que está pedindo, link de outra conta
e link sem dono — o que a home cria para quem não tem conta.
"""

import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import ShortenedURL

User = get_user_model()

PASSWORD = "prancheta-2026-forte"


def detail_url(short_code):
    return reverse("shortened-url-detail", kwargs={"short_code": short_code})


class LinkOwnershipTest(APITestCase):
    def setUp(self):
        self.davi = User.objects.create_user(
            username="davi@exemplo.com", email="davi@exemplo.com", password=PASSWORD
        )
        self.outra = User.objects.create_user(
            username="outra@exemplo.com", email="outra@exemplo.com", password=PASSWORD
        )

        self.meu = ShortenedURL.objects.create(
            original_url="https://meu.exemplo.com", short_code="meu123", owner=self.davi
        )
        self.dela = ShortenedURL.objects.create(
            original_url="https://dela.exemplo.com", short_code="dela12", owner=self.outra
        )
        self.orfao = ShortenedURL.objects.create(
            original_url="https://orfao.exemplo.com", short_code="orfao1"
        )

        self.list_url = reverse("shortened-url-list")

    def as_davi(self):
        self.client.force_authenticate(self.davi)

    # Listagem — o painel

    def test_list_requires_an_account(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_the_links_of_the_account(self):
        self.as_davi()
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [item["short_code"] for item in response.data["results"]]  # type: ignore
        self.assertEqual(codes, ["meu123"])

    def test_search_does_not_escape_the_account(self):
        self.as_davi()
        response = self.client.get(self.list_url, {"search": "dela"})

        self.assertEqual(response.data["count"], 0)  # type: ignore

    def test_status_filter_does_not_escape_the_account(self):
        self.as_davi()
        response = self.client.get(self.list_url, {"is_active": "true"})

        codes = [item["short_code"] for item in response.data["results"]]  # type: ignore
        self.assertEqual(codes, ["meu123"])

    # Link de outra conta

    def test_reading_another_account_link_is_forbidden(self):
        self.as_davi()
        response = self.client.get(detail_url("dela12"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_changing_another_account_link_is_forbidden(self):
        self.as_davi()
        response = self.client.patch(
            detail_url("dela12"), {"original_url": "https://invadido.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.dela.refresh_from_db()
        self.assertEqual(self.dela.original_url, "https://dela.exemplo.com")

    def test_deleting_another_account_link_is_forbidden(self):
        self.as_davi()
        response = self.client.delete(detail_url("dela12"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(ShortenedURL.objects.filter(short_code="dela12").exists())

    def test_custom_actions_of_another_account_are_forbidden(self):
        self.as_davi()
        for suffix, method in [
            ("activate", self.client.post),
            ("deactivate", self.client.post),
            ("statistics", self.client.get),
            ("qrcode", self.client.get),
        ]:
            with self.subTest(acao=suffix):
                response = method(f"/api/urls/dela12/{suffix}/")
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_code_still_answers_404_not_403(self):
        """O 404 vem antes da permissao — 403 revelaria quais codigos existem."""
        self.as_davi()
        response = self.client.get(detail_url("naoexiste"))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # Link sem dono

    def test_anyone_reads_an_orphan_link(self):
        """Quem encurta na home sem conta precisa ver o resultado e o QR Code."""
        # Criado pela API, e nao pelo ORM, porque so esse caminho gera o PNG
        # que a rota /qrcode/ devolve. MEDIA_ROOT temporario para o teste nao
        # deixar arquivo no diretorio da aplicacao.
        with tempfile.TemporaryDirectory() as media:
            with override_settings(MEDIA_ROOT=media):
                created = self.client.post(
                    self.list_url, {"original_url": "https://sem-conta.com"}, format="json"
                )
                code = created.data["short_code"]  # type: ignore

                for suffix in ["", "statistics/", "qrcode/"]:
                    with self.subTest(rota=suffix or "detalhe"):
                        response = self.client.get(f"/api/urls/{code}/{suffix}")
                        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_change_an_orphan_link(self):
        response = self.client.patch(
            detail_url("orfao1"), {"original_url": "https://sequestrado.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.orfao.refresh_from_db()
        self.assertEqual(self.orfao.original_url, "https://orfao.exemplo.com")

    def test_an_account_cannot_adopt_an_orphan_link_through_the_api(self):
        """Sem dono nao ha quem autorize a mudanca — nem para quem tem conta."""
        self.as_davi()
        for method, path in [
            (self.client.patch, detail_url("orfao1")),
            (self.client.delete, detail_url("orfao1")),
            (self.client.post, "/api/urls/orfao1/deactivate/"),
        ]:
            with self.subTest(rota=path):
                self.assertEqual(method(path).status_code, status.HTTP_403_FORBIDDEN)

    # O dono

    def test_owner_manages_the_own_link(self):
        self.as_davi()

        patched = self.client.patch(
            detail_url("meu123"), {"original_url": "https://novo.exemplo.com"}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK)

        deactivated = self.client.post("/api/urls/meu123/deactivate/")
        self.assertEqual(deactivated.status_code, status.HTTP_200_OK)

        deleted = self.client.delete(detail_url("meu123"))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    # Criacao

    def test_anonymous_creation_produces_an_orphan(self):
        response = self.client.post(
            self.list_url, {"original_url": "https://sem-conta.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = ShortenedURL.objects.get(short_code=response.data["short_code"])  # type: ignore
        self.assertIsNone(created.owner)

    def test_authenticated_creation_sets_the_owner(self):
        self.as_davi()
        response = self.client.post(
            self.list_url, {"original_url": "https://com-conta.com"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = ShortenedURL.objects.get(short_code=response.data["short_code"])  # type: ignore
        self.assertEqual(created.owner, self.davi)

        # E aparece no painel dela na sequencia.
        listed = self.client.get(self.list_url)
        codes = [item["short_code"] for item in listed.data["results"]]  # type: ignore
        self.assertIn(created.short_code, codes)

    def test_deleting_the_account_takes_its_links(self):
        self.outra.delete()

        self.assertFalse(ShortenedURL.objects.filter(short_code="dela12").exists())
        # Os links das outras contas e os orfaos ficam onde estavam.
        self.assertTrue(ShortenedURL.objects.filter(short_code="meu123").exists())
        self.assertTrue(ShortenedURL.objects.filter(short_code="orfao1").exists())


class RedirectStaysPublicTest(APITestCase):
    """O redirect nao tem dono: link publicado funciona para qualquer visitante."""

    def setUp(self):
        owner = User.objects.create_user(
            username="davi@exemplo.com", email="davi@exemplo.com", password=PASSWORD
        )
        self.link = ShortenedURL.objects.create(
            original_url="https://destino.exemplo.com", short_code="publi1", owner=owner
        )

    def test_anonymous_visitor_is_redirected(self):
        response = self.client.get("/api/r/publi1/")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "https://destino.exemplo.com")  # type: ignore

    def test_click_is_counted_for_the_owner_link(self):
        self.client.get("/api/r/publi1/", REMOTE_ADDR="203.0.113.7")

        self.link.refresh_from_db()
        self.assertEqual(self.link.total_clicks, 1)
        self.assertEqual(self.link.unique_clicks, 1)
