from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from shortener.models import Click, ShortenedURL


class ShortenedURLViewSetTest(APITestCase):
    def setUp(self):
        self.url1 = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="test1",
        )
        self.url2 = ShortenedURL.objects.create(
            original_url="https://google.com",
            short_code="test2",
            is_active=False,
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
