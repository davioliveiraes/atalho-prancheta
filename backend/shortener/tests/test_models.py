from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from shortener.models import Click, ShortenedURL


class ShortenedURLModelTest(TestCase):
    def setUp(self):
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com", short_code="test123"
        )

    def test_create_shortened_url(self):
        self.assertEqual(self.url.original_url, "https://example.com")
        self.assertEqual(self.url.short_code, "test123")
        self.assertTrue(self.url.is_active)
        self.assertEqual(self.url.total_clicks, 0)
        self.assertEqual(self.url.unique_clicks, 0)

    def test_str_method(self):
        result = str(self.url)
        self.assertIn("test123", result)
        self.assertIn("https://example.com", result)
        self.assertIn("->", result)

    def test_is_expired_false(self):
        self.assertFalse(self.url.is_expired())

    def test_is_expired_true(self):
        self.url.expires_at = timezone.now() + timedelta(days=1)
        self.url.save()
        self.assertFalse(self.url.is_expired())

    def test_is_expired_false_future(self):
        self.url.expires_at = timezone.now() + timedelta(days=1)
        self.url.save()
        self.url.refresh_from_db()
        self.assertFalse(self.url.is_expired())

    def test_has_reached_max_clicks_false(self):
        self.assertFalse(self.url.has_reached_max_clicks())

    def test_has_reached_max_clicks_true(self):
        self.url.max_clicks = 5
        self.url.unique_clicks = 5
        self.url.save()
        self.url.refresh_from_db()
        self.assertTrue(self.url.has_reached_max_clicks())

    def test_has_reached_max_clicks_false_below_limit(self):
        self.url.max_clicks = 10
        self.url.total_clicks = 5
        self.url.save()
        self.assertFalse(self.url.has_reached_max_clicks())

    def test_can_be_accessed_active(self):
        can_access, message = self.url.can_be_accessed()
        self.assertTrue(can_access)
        self.assertEqual(message, "OK")

    def test_can_be_accessed_inactive(self):
        self.url.is_active = False
        self.url.save()
        can_access, message = self.url.can_be_accessed()
        self.assertFalse(can_access)
        self.assertIn("inativo", message.lower())

    def test_can_be_accessed_expired(self):
        self.url.expires_at = timezone.now() - timedelta(days=1)
        self.url.save()
        can_access, message = self.url.can_be_accessed()
        self.assertFalse(can_access)
        self.assertIn("expirado", message.lower())

    def test_can_be_accessed_max_clicks(self):
        self.url.max_clicks = 5
        self.url.unique_clicks = 5
        self.url.save()
        self.url.refresh_from_db()
        can_access, message = self.url.can_be_accessed()
        self.assertFalse(can_access)
        self.assertIn("limite", message.lower())

    def test_unique_short_code(self):
        from django.db import IntegrityError, transaction

        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                ShortenedURL.objects.create(
                    original_url="https://notio.com",
                    short_code="test123",
                )


class ClickModelTest(TestCase):
    def setUp(self):
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="click123",
        )
        self.click = Click.objects.create(
            url=self.url,
            ip_address="192.168.1.1",
            user_agent="Mozila/5.0",
            referer="https://google.com",
        )

    def test_create_click(self):
        self.assertEqual(self.click.url, self.url)
        self.assertEqual(self.click.ip_address, "192.168.1.1")
        self.assertEqual(self.click.user_agent, "Mozila/5.0")
        self.assertEqual(self.click.referer, "https://google.com")
        self.assertIsNotNone(self.click.clicked_at)

    def test_str_method(self):
        result = str(self.click)
        self.assertIn("click123", result)
        self.assertIn("Clique", result)

    def test_click_ordering(self):
        click2 = Click.objects.create(
            url=self.url,
            ip_address="192.168.1.2",
        )
        clicks = Click.objects.all()
        self.assertEqual(clicks[0], click2)
        self.assertEqual(clicks[1], self.click)

    def test_related_name_clicks(self):
        self.assertEqual(self.url.clicks.count(), 1)  # type: ignore
        self.assertEqual(self.url.clicks.first(), self.click)  # type: ignore
