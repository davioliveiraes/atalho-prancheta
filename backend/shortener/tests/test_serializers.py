from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from shortener.models import Click, ShortenedURL
from shortener.serializers import (
    ClickSerializer,
    ShortenedURLCreateSerializer,
    ShortenedURLDetailSerializer,
    ShortenedURLListSerializer,
    ShortenedURLUpdateSerializer,
)


class ShortenedURLCreateSerializerTest(TestCase):
    def test_create_with_custom_code(self):
        data = {
            "original_url": "https://example.com",
            "short_code": "custom",
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        url = serializer.save()
        self.assertEqual(url.short_code, "custom")  # type: ignore
        self.assertEqual(url.original_url, "https://example.com")  # type: ignore

    def test_create_without_code_genarates_random(self):
        data = {"original_url": "https://example.com"}
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        url = serializer.save()
        self.assertIsNotNone(url.short_code)  # type: ignore
        self.assertEqual(len(url.short_code), 6)  # type: ignore

    def test_validate_duplicate_code(self):
        ShortenedURL.objects.create(
            original_url="https://first.com",
            short_code="duplicate",
        )
        data = {
            "original_url": "https://second.com",
            "short_code": "duplicate",
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("short_code", serializer.errors)

    def test_validate_short_code_min_length(self):
        data = {
            "original_url": "https//example.com",
            "short_code": "ab",
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("short_code", serializer.errors)

    def test_validate_short_code_alphanumeric(self):
        data = {
            "original_url": "https://example.com",
            "short_code": "abc@123",
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("short_code", serializer.errors)

    def test_validate_expires_at_future(self):
        data = {
            "original_url": "https://example.com",
            "short_code": "test",
            "expires_at": timezone.now() - timedelta(days=1),
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("expires_at", serializer.errors)

    def test_validate_max_clicks_positive(self):
        data = {
            "original_url": "https://example.com",
            "short_code": "test",
            "max_clicks": 0,
        }
        serializer = ShortenedURLCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("max_clicks", serializer.errors)


class ShortenedURLListSerializerTest(TestCase):
    def test_serializer_url(self):
        url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="list123",
        )
        serializer = ShortenedURLListSerializer(url)
        data = serializer.data

        self.assertEqual(data["short_code"], "list123")  # type: ignore
        self.assertEqual(data["original_url"], "https://example.com")  # type: ignore
        self.assertIn("short_url", data)
        self.assertIn("status", data)
        self.assertTrue(data["is_active"])  # type: ignore


class ShortenedURLDetailSerializerTest(TestCase):
    def test_serialize_url_with_clicks(self):
        url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="detail123",
        )
        Click.objects.create(url=url, ip_address="192.168.1.1")

        serializer = ShortenedURLDetailSerializer(url)
        data = serializer.data

        self.assertEqual(data["short_code"], "detail123")  # type: ignore
        self.assertIn("statistics", data)
        self.assertIn("recent_clicks", data)


class ClickSerializerTest(TestCase):
    def test_serialize_url_with_clicks(self):
        url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="click123",
        )
        click = Click.objects.create(
            url=url,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            referer="https://google.com",
        )

        seriliazer = ClickSerializer(click)
        data = seriliazer.data

        self.assertEqual(data["ip_address"], "192.168.1.1")  # type: ignore
        self.assertEqual(data["user_agent"], "Mozilla/5.0")  # type: ignore
        self.assertEqual(data["referer"], "https://google.com")  # type: ignore
        self.assertIn("clicked_at", data)
