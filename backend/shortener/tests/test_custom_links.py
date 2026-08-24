"""
O link personalizado pela API: apelido escolhido, destino trocado depois.

O que estes testes guardam é o caso inteiro do encurtador — criar
`grupowhatsempresa` apontando para um lugar, editar o destino pelo painel e
conferir que o mesmo endereço passa a levar ao novo, sem que o apelido, o QR
Code ou o histórico de cliques mudem.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import ShortenedURL

User = get_user_model()


class OwnerTestCase(APITestCase):
    """Cenário comum: uma conta autenticada e a rota de lista."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="dono@exemplo.com",
            email="dono@exemplo.com",
            password="prancheta-2026-forte",
        )
        self.client.force_authenticate(self.owner)
        self.list_url = reverse("shortened-url-list")

    def detail_url(self, short_code):
        return reverse("shortened-url-detail", kwargs={"short_code": short_code})


class CustomLinkFlowTest(OwnerTestCase):
    def test_the_whole_flow(self):
        created = self.client.post(
            self.list_url,
            {
                "original_url": "https://google.com",
                "short_code": "grupowhatsempresa",
                "subdomain": "grupowhatsempresa",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        first = self.client.get("/grupowhatsempresa")
        self.assertEqual(first.url, "https://google.com")  # type: ignore

        edited = self.client.patch(
            self.detail_url("grupowhatsempresa"),
            {"original_url": "https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm"},
            format="json",
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertEqual(edited.data["short_code"], "grupowhatsempresa")  # type: ignore

        second = self.client.get("/grupowhatsempresa")
        self.assertEqual(second.url, "https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm")  # type: ignore

    def test_a_long_alias_is_accepted(self):
        """O teto era 10 caracteres, e `grupowhatsempresa` tem 17."""
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "short_code": "grupowhatsempresa"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_a_hyphenated_alias_is_accepted(self):
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "short_code": "loja-natal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_an_accented_alias_is_refused(self):
        """`str.isalnum()` aceitava `café`, que não existe em rótulo DNS."""
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "short_code": "café-natal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("short_code", response.data)  # type: ignore

    def test_the_short_code_cannot_be_edited(self):
        """O apelido é o endereço já divulgado: o PATCH não o troca."""
        ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="loja-natal", owner=self.owner
        )

        response = self.client.patch(
            self.detail_url("loja-natal"), {"short_code": "outro-nome"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["short_code"], "loja-natal")  # type: ignore


class DestinationFieldTest(OwnerTestCase):
    """As regras do destino, aplicadas igual na criação e na edição."""

    def test_a_destination_without_a_scheme_is_completed(self):
        response = self.client.post(
            self.list_url,
            {"original_url": "chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["original_url"],  # type: ignore
            "https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm",
        )

    def test_the_campaign_parameters_survive(self):
        destination = "https://loja.com/promo?utm_source=whatsapp&utm_campaign=natal"

        response = self.client.post(self.list_url, {"original_url": destination}, format="json")

        self.assertEqual(response.data["original_url"], destination)  # type: ignore

    def test_a_destination_that_is_not_http_is_refused(self):
        response = self.client.post(
            self.list_url, {"original_url": "ftp://exemplo.com/arquivo"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_edition_completes_the_scheme_too(self):
        ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="loja-natal", owner=self.owner
        )

        response = self.client.patch(
            self.detail_url("loja-natal"),
            {"original_url": "chat.whatsapp.com/NOVOGRUPO"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["original_url"],  # type: ignore
            "https://chat.whatsapp.com/NOVOGRUPO",
        )


class SubdomainFieldTest(OwnerTestCase):
    """O subdomínio pela API: único, opcional e removível."""

    def setUp(self):
        super().setUp()
        self.link = ShortenedURL.objects.create(
            original_url="https://exemplo.com",
            short_code="loja-natal",
            subdomain="loja-natal",
            owner=self.owner,
        )

    def test_the_detail_shows_the_two_addresses(self):
        with self.settings(SHORTLINK_BASE_DOMAIN="atalho.app"):
            response = self.client.get(self.detail_url("loja-natal"))

        self.assertTrue(response.data["short_url"].endswith("/loja-natal"))  # type: ignore
        self.assertEqual(response.data["subdomain_url"], "http://loja-natal.atalho.app")  # type: ignore

    def test_without_the_domain_configured_there_is_no_second_address(self):
        """
        A mesma chave liga o middleware e o endereço mostrado na tela.

        Anunciar `loja-natal.algum.dominio` com o middleware desligado seria
        entregar ao dono um endereço que ninguém atende.
        """
        with self.settings(SHORTLINK_BASE_DOMAIN=""):
            response = self.client.get(self.detail_url("loja-natal"))

        self.assertEqual(response.data["subdomain"], "loja-natal")  # type: ignore
        self.assertIsNone(response.data["subdomain_url"])  # type: ignore

    def test_a_link_without_a_subdomain_has_no_second_address(self):
        ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="semsub", owner=self.owner
        )

        response = self.client.get(self.detail_url("semsub"))

        self.assertIsNone(response.data["subdomain_url"])  # type: ignore

    def test_a_taken_subdomain_is_refused(self):
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "subdomain": "loja-natal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("subdomain", response.data)  # type: ignore

    def test_the_comparison_ignores_the_case(self):
        """O Host chega em minúsculas: `Loja-Natal` e `loja-natal` são um só."""
        response = self.client.post(
            self.list_url,
            {"original_url": "https://exemplo.com", "subdomain": "Loja-Natal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_reserved_subdomain_is_refused(self):
        for label in ("www", "painel"):
            with self.subTest(label=label):
                response = self.client.post(
                    self.list_url,
                    {"original_url": "https://exemplo.com", "subdomain": label},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_empty_subdomain_removes_it(self):
        response = self.client.patch(
            self.detail_url("loja-natal"), {"subdomain": ""}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertIsNone(self.link.subdomain)

    def test_keeping_its_own_subdomain_is_not_a_conflict(self):
        """Salvar a tela inteira reenvia o subdomínio que já era do link."""
        response = self.client.patch(
            self.detail_url("loja-natal"),
            {"original_url": "https://novo.exemplo.com", "subdomain": "loja-natal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
