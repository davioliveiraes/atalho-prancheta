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


class ShortenedURLUpdateSerializerTest(TestCase):
    """O serializador que a view usa no PATCH — quatro campos, e so."""

    def setUp(self):
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="upd123",
            total_clicks=4,
            unique_clicks=3,
        )

    def test_short_code_and_counters_are_not_fields(self):
        fields = set(ShortenedURLUpdateSerializer().fields)
        self.assertEqual(fields, {"original_url", "is_active", "expires_at", "max_clicks"})

    def test_rejects_a_new_expiration_in_the_past(self):
        serializer = ShortenedURLUpdateSerializer(
            self.url, data={"expires_at": timezone.now() - timedelta(days=1)}, partial=True
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("expires_at", serializer.errors)

    def test_accepts_the_expiration_the_link_already_had(self):
        past = timezone.now() - timedelta(days=1)
        self.url.expires_at = past
        self.url.save()

        serializer = ShortenedURLUpdateSerializer(
            self.url,
            data={"original_url": "https://example.com/novo", "expires_at": past},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_zero_as_unlimited(self):
        """Na criacao 0 e recusado; na edicao e o caminho de volta ao ilimitado."""
        serializer = ShortenedURLUpdateSerializer(self.url, data={"max_clicks": 0}, partial=True)

        self.assertTrue(serializer.is_valid(), serializer.errors)


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

    def test_serializer_includes_limit_fields(self):
        """As fichas do painel dependem destes dois campos vindos da lista."""
        expires_at = timezone.now() + timedelta(days=2)
        url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="limits1",
            expires_at=expires_at,
            max_clicks=50,
        )
        data = ShortenedURLListSerializer(url).data

        self.assertEqual(data["max_clicks"], 50)  # type: ignore
        self.assertIsNotNone(data["expires_at"])  # type: ignore

    def test_serializer_limit_fields_when_unset(self):
        url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="limits2",
        )
        data = ShortenedURLListSerializer(url).data

        self.assertEqual(data["max_clicks"], 0)  # type: ignore
        self.assertIsNone(data["expires_at"])  # type: ignore


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
