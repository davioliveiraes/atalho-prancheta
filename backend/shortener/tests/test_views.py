from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import Click, ShortenedURL

User = get_user_model()


class ShortenedURLViewSetTest(APITestCase):
    def setUp(self):
        # O painel e as rotas de alteracao pertencem a uma conta; os links do
        # cenario sao dela.
        self.owner = User.objects.create_user(
            username="dono@exemplo.com", email="dono@exemplo.com", password="prancheta-2026-forte"
        )
        self.client.force_authenticate(self.owner)

        self.url1 = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="test1",
            owner=self.owner,
        )
        self.url2 = ShortenedURL.objects.create(
            original_url="https://google.com",
            short_code="test2",
            is_active=False,
            owner=self.owner,
        )
        self.list_url = reverse("shortened-url-list")

    def test_list_urls(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)  # type: ignore

    def test_list_urls_filter_active(self):
        response = self.client.get(self.list_url, {"is_active": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)  # type: ignore
        self.assertEqual(response.data["results"][0]["short_code"], "test1")  # type: ignore

    def test_list_urls_search(self):
        response = self.client.get(self.list_url, {"search": "google"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)  # type: ignore
        self.assertEqual(response.data["results"][0]["short_code"], "test2")  # type: ignore

    def test_create_url_with_custom_code(self):
        data = {
            "original_url": "https://github.com",
            "short_code": "github",
        }
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["short_code"], "github")  # type: ignore
        self.assertIn("qr_code", response.data)  # type: ignore

    def test_create_url_without_code(self):
        data = {"original_url": "https://twitter.com"}
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["short_code"])  # type: ignore
        self.assertEqual(len(response.data["short_code"]), 6)  # type: ignore

    def test_create_url_duplicate_code(self):
        data = {
            "original_url": "https://duplicate.com",
            "short_code": "test1",
        }
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("short_code", response.data)  # type: ignore

    def test_create_url_invalid_code(self):
        data = {
            "original_url": "https://exemple.com",
            "short_code": "ab",
        }
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_url(self):
        url = reverse("shortened-url-detail", kwargs={"short_code": "test1"})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["short_code"], "test1")  # type: ignore
        self.assertIn("statistics", response.data)  # type: ignore
        self.assertIn("recent_clicks", response.data)  # type: ignore

    def test_retrieve_url_not_found(self):
        url = reverse("shortened-url-detail", kwargs={"short_code": "notfound"})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_not_found_message_is_in_portuguese(self):
        """
        O `detail` do 404 chega ate a tela de detalhe do link, entao nao pode ser
        a frase padrao do Django ("No ShortenedURL matches the given query.").
        """
        url = reverse("shortened-url-detail", kwargs={"short_code": "notfound"})
        response = self.client.get(url)

        detail = str(response.data["detail"])  # type: ignore
        self.assertEqual(detail, "Nenhum link cadastrado com este código.")
        self.assertNotIn("ShortenedURL", detail)

    def test_custom_actions_share_the_translated_not_found(self):
        """As acoes personalizadas passam pelo mesmo get_object()."""
        for suffix in ["statistics", "qrcode", "activate", "deactivate"]:
            with self.subTest(acao=suffix):
                method = self.client.get if suffix in ("statistics", "qrcode") else self.client.post
                response = method(f"/api/urls/notfound/{suffix}/")

                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                self.assertEqual(
                    str(response.data["detail"]),  # type: ignore
                    "Nenhum link cadastrado com este código.",
                )

    def test_update_url(self):
        url = reverse("shortened-url-detail", kwargs={"short_code": "test1"})
        data = {"is_active": False}
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])  # type: ignore

    def test_delete_url(self):
        url = reverse("shortened-url-detail", kwargs={"short_code": "test1"})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ShortenedURL.objects.filter(short_code="test1").exists())

    def test_activate_url(self):
        url = f"/api/urls/{self.url2.short_code}/activate/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.url2.refresh_from_db()
        self.assertTrue(self.url2.is_active)

    def test_deactivate_url(self):
        url = f"/api/urls/{self.url1.short_code}/deactivate/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.url1.refresh_from_db()
        self.assertFalse(self.url1.is_active)

    def test_statistics_endpoint(self):
        Click.objects.create(url=self.url1, ip_address="192.168.1.1")
        Click.objects.create(url=self.url1, ip_address="192.168.1.2")

        url = f"/api/urls/{self.url1.short_code}/statistics/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_clicks", response.data)  # type: ignore
        self.assertIn("recent_clicks", response.data)  # type: ignore

    def test_qrcode_endpoint(self):
        url = f"/api/urls/{self.url1.short_code}/qrcode/"
        response = self.client.get(url)

        if response.status_code == status.HTTP_200_OK:
            self.assertIn("qr_code_url", response.data)  # type: ignore
        else:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RedirectViewTest(TestCase):
    def setUp(self):
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="redirect",
        )

    def test_redirect_active_url(self):
        response = self.client.get(f"/api/r/{self.url.short_code}/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, self.url.original_url)  # type: ignore

    def test_redirect_creates_click(self):
        initial_clicks = Click.objects.count()
        self.client.get(f"/api/r/{self.url.short_code}/")
        self.assertEqual(Click.objects.count(), initial_clicks + 1)

    def test_redirect_increments_total_clicks(self):
        initial_total = self.url.total_clicks
        self.client.get(f"/api/r/{self.url.short_code}/")
        self.url.refresh_from_db()
        self.assertEqual(self.url.total_clicks, initial_total + 1)

    def test_redirect_increments_unique_clicks(self):
        initial_unique = self.url.unique_clicks
        self.client.get(f"/api/r/{self.url.short_code}/", REMOTE_ADDR="192.168.1.100")
        self.url.refresh_from_db()
        self.assertEqual(self.url.unique_clicks, initial_unique + 1)

    def test_redirect_same_ip_not_unique(self):
        self.client.get(f"/api/r/{self.url.short_code}/", REMOTE_ADDR="192.168.1.100")
        self.url.refresh_from_db()
        unique_after_first = self.url.unique_clicks

        self.client.get(f"/api/r/{self.url.short_code}/", REMOTE_ADDR="192.168.1.100")
        self.url.refresh_from_db()
        self.assertEqual(self.url.unique_clicks, unique_after_first)

    def test_redirect_inactive_url(self):
        self.url.is_active = False
        self.url.save()
        response = self.client.get(f"/api/r/{self.url.short_code}/")
        self.assertEqual(response.status_code, 403)

    def test_redirect_expired_url(self):
        self.url.expires_at = timezone.now() - timedelta(days=1)
        self.url.save()
        response = self.client.get(f"/api/r/{self.url.short_code}/")
        self.assertEqual(response.status_code, 403)

    def test_redirect_max_clicks_reached(self):
        self.url.max_clicks = 2
        self.url.unique_clicks = 2
        self.url.save()
        response = self.client.get(f"/api/r/{self.url.short_code}/")
        self.assertEqual(response.status_code, 403)

    def test_redirect_not_found(self):
        response = self.client.get("/api/r/notfound/")
        self.assertEqual(response.status_code, 404)

    def test_click_stores_user_agent(self):
        self.client.get(f"/api/r/{self.url.short_code}/", HTTP_USER_AGENT="TestBrowser/1.0")
        click = Click.objects.latest("clicked_at")
        self.assertIn("TestBrowser", click.user_agent)

    def test_click_stores_referer(self):
        self.client.get(f"/api/r/{self.url.short_code}/", HTTP_REFERER="https://google.com")
        click = Click.objects.latest("clicked_at")
        self.assertEqual(click.referer, "https://google.com")


class UpdateProtectionTest(APITestCase):
    """
    O que um PATCH pode e nao pode mudar.

    A view atualiza pelo ShortenedURLUpdateSerializer, que expoe quatro campos.
    Codigo curto e contadores de clique nao estao entre eles: o codigo e o que
    foi divulgado e os contadores sao do redirect, nao de quem edita.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username="dono@exemplo.com", email="dono@exemplo.com", password="prancheta-2026-forte"
        )
        self.client.force_authenticate(self.owner)

        self.link = ShortenedURL.objects.create(
            original_url="https://exemplo.com",
            short_code="fixo12",
            total_clicks=7,
            unique_clicks=5,
            owner=self.owner,
        )
        self.url = reverse("shortened-url-detail", kwargs={"short_code": "fixo12"})

    def test_patch_does_not_change_the_short_code(self):
        response = self.client.patch(self.url, {"short_code": "outro9"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertEqual(self.link.short_code, "fixo12")
        self.assertFalse(ShortenedURL.objects.filter(short_code="outro9").exists())

    def test_patch_does_not_change_the_click_counters(self):
        response = self.client.patch(
            self.url, {"total_clicks": 9999, "unique_clicks": 9999}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertEqual(self.link.total_clicks, 7)
        self.assertEqual(self.link.unique_clicks, 5)

    def test_patch_changes_what_it_should(self):
        expires_at = timezone.now() + timedelta(days=3)
        response = self.client.patch(
            self.url,
            {
                "original_url": "https://exemplo.com/novo",
                "is_active": False,
                "expires_at": expires_at.isoformat(),
                "max_clicks": 25,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertEqual(self.link.original_url, "https://exemplo.com/novo")
        self.assertFalse(self.link.is_active)
        self.assertEqual(self.link.max_clicks, 25)
        self.assertIsNotNone(self.link.expires_at)

    def test_patch_rejects_an_expiration_in_the_past(self):
        past = timezone.now() - timedelta(days=1)
        response = self.client.patch(self.url, {"expires_at": past.isoformat()}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expires_at", response.data)  # type: ignore

    def test_an_expired_link_is_still_editable(self):
        """A tela repoe a data atual do link ao salvar; ela nao pode ser recusada."""
        past = timezone.now() - timedelta(days=1)
        self.link.expires_at = past
        self.link.save()

        response = self.client.patch(
            self.url,
            {"original_url": "https://exemplo.com/corrigido", "expires_at": past.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertEqual(self.link.original_url, "https://exemplo.com/corrigido")

    def test_max_clicks_zero_returns_the_link_to_unlimited(self):
        self.link.max_clicks = 10
        self.link.save()

        response = self.client.patch(self.url, {"max_clicks": 0}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertEqual(self.link.max_clicks, 0)
        self.assertFalse(self.link.has_reached_max_clicks())

    def test_expiration_can_be_cleared(self):
        self.link.expires_at = timezone.now() + timedelta(days=1)
        self.link.save()

        response = self.client.patch(self.url, {"expires_at": None}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.link.refresh_from_db()
        self.assertIsNone(self.link.expires_at)

    def test_response_is_still_the_full_detail(self):
        """A tela de detalhe redesenha com o corpo da resposta do PATCH."""
        response = self.client.patch(
            self.url, {"original_url": "https://exemplo.com/outro"}, format="json"
        )

        for field in ["short_url", "statistics", "status", "recent_clicks", "qr_code"]:
            with self.subTest(campo=field):
                self.assertIn(field, response.data)  # type: ignore
