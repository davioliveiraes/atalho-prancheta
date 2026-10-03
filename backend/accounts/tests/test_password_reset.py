import re
from datetime import datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.settings import api_settings
from rest_framework.test import APITestCase
from rest_framework.throttling import SimpleRateThrottle

from accounts.password_reset import INVALID_LINK_MESSAGE, encode_uid

User = get_user_model()

OLD_PASSWORD = "prancheta-2026-forte"
NEW_PASSWORD = "outra-prancheta-2027"

SITE = "https://atalho.test"

LINK_PATTERN = re.compile(r"(\S+)#uid=([^&\s]+)&token=(\S+)")


def link_from(message):
    """Base, uid e token do link que está no corpo do e-mail."""
    match = LINK_PATTERN.search(message.body)
    assert match, f"nenhum link no e-mail:\n{message.body}"
    return match.group(1), match.group(2), match.group(3)


@override_settings(SITE_URL=SITE)
class PasswordResetRequestTest(APITestCase):
    def setUp(self):
        # O teto do DRF e o intervalo entre e-mails moram no cache.
        cache.clear()
        self.url = reverse("accounts:password-reset")
        self.user = User.objects.create_user(
            username="davi@exemplo.com",
            email="davi@exemplo.com",
            password=OLD_PASSWORD,
            first_name="Davi",
        )

    def ask(self, email="davi@exemplo.com", **extra):
        return self.client.post(self.url, {"email": email}, format="json", **extra)

    def test_sends_a_link_to_an_existing_account(self):
        response = self.ask()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["davi@exemplo.com"])
        self.assertIn("Davi", mail.outbox[0].body)

        base, uid, token = link_from(mail.outbox[0])
        self.assertEqual(base, f"{SITE}/redefinir-senha")
        self.assertEqual(uid, encode_uid(self.user))
        self.assertTrue(PasswordResetTokenGenerator().check_token(self.user, token))

    def test_the_link_is_not_html_escaped(self):
        """Texto puro: um `&amp;` no lugar do `&` quebraria o link."""
        self.ask()
        self.assertNotIn("&amp;", mail.outbox[0].body)

    def test_unknown_email_gets_the_same_answer_and_no_message(self):
        known = self.ask()
        cache.clear()
        unknown = self.ask(email="ninguem@exemplo.com")

        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.data, known.data)  # type: ignore
        self.assertEqual(len(mail.outbox), 1)

    def test_email_is_matched_in_any_case(self):
        self.ask(email="DAVI@Exemplo.com")
        self.assertEqual(len(mail.outbox), 1)

    def test_inactive_account_gets_nothing(self):
        self.user.is_active = False
        self.user.save()

        response = self.ask()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_account_without_usable_password_gets_nothing(self):
        self.user.set_unusable_password()
        self.user.save()

        self.ask()

        self.assertEqual(len(mail.outbox), 0)

    def test_a_second_request_right_after_sends_nothing_new(self):
        """O intervalo vale por conta, e não por IP: protege a caixa de entrada."""
        self.ask()
        response = self.ask(REMOTE_ADDR="10.0.0.99")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(ALLOWED_HOSTS=["*"])
    def test_the_link_ignores_the_host_header(self):
        """Quem pede escreve o Host; o link do e-mail não pode sair dele."""
        self.ask(HTTP_HOST="atacante.example")

        base, _uid, _token = link_from(mail.outbox[0])
        self.assertTrue(base.startswith(SITE))
        self.assertNotIn("atacante", mail.outbox[0].body)

    def test_rejects_a_malformed_email(self):
        response = self.ask(email="nao-e-email")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)  # type: ignore

    def test_requests_are_capped_per_ip(self):
        # O ScopedRateThrottle copia as taxas para um atributo de classe na
        # importação, e o `override_settings` não chega lá — é o mesmo motivo do
        # SettingsRateMixin de `shortener/throttling.py`. O patch vai direto nele.
        rates = {**api_settings.DEFAULT_THROTTLE_RATES, "auth-password-reset": "2/hour"}
        with mock.patch.object(SimpleRateThrottle, "THROTTLE_RATES", rates):
            self.ask(email="a@exemplo.com")
            self.ask(email="b@exemplo.com")
            response = self.ask(email="c@exemplo.com")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


@override_settings(SITE_URL=SITE)
class PasswordResetConfirmTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("accounts:password-reset-confirm")
        self.user = User.objects.create_user(
            username="davi@exemplo.com",
            email="davi@exemplo.com",
            password=OLD_PASSWORD,
        )
        self.client.post(
            reverse("accounts:password-reset"), {"email": "davi@exemplo.com"}, format="json"
        )
        _base, self.uid, self.token = link_from(mail.outbox[0])

    def confirm(self, **overrides):
        data = {
            "uid": self.uid,
            "token": self.token,
            "password": NEW_PASSWORD,
            "password_confirm": NEW_PASSWORD,
        }
        data.update(overrides)
        return self.client.post(self.url, data, format="json")

    def login(self, password):
        return self.client.post(
            reverse("accounts:login"),
            {"email": "davi@exemplo.com", "password": password},
            format="json",
        )

    def test_changes_the_password(self):
        response = self.confirm()

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.login(NEW_PASSWORD).status_code, status.HTTP_200_OK)
        self.assertEqual(self.login(OLD_PASSWORD).status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_link_works_only_once(self):
        self.confirm()
        response = self.confirm(
            password="terceira-prancheta-28", password_confirm="terceira-prancheta-28"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore
        self.assertEqual(self.login(NEW_PASSWORD).status_code, status.HTTP_200_OK)

    def test_the_link_expires(self):
        later = datetime.now() + timedelta(hours=2)
        with mock.patch.object(PasswordResetTokenGenerator, "_now", return_value=later):
            response = self.confirm()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore

    def test_rejects_a_forged_token(self):
        response = self.confirm(token="abc-0123456789abcdef")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore

    def test_rejects_a_uid_that_does_not_decode(self):
        response = self.confirm(uid="!!!")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore

    def test_a_link_for_one_account_does_not_open_another(self):
        other = User.objects.create_user(
            username="outra@exemplo.com", email="outra@exemplo.com", password=OLD_PASSWORD
        )

        response = self.confirm(uid=encode_uid(other))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        other.refresh_from_db()
        self.assertTrue(other.check_password(OLD_PASSWORD))

    def test_deactivated_account_cannot_use_its_link(self):
        self.user.is_active = False
        self.user.save()

        response = self.confirm()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_password_mismatch(self):
        response = self.confirm(password_confirm="nao-e-a-mesma-senha")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)  # type: ignore
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(OLD_PASSWORD))

    def test_applies_django_password_validators(self):
        response = self.confirm(password="12345678", password_confirm="12345678")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)  # type: ignore

    def test_rejects_a_password_too_close_to_the_email(self):
        """Com a conta em mãos, o validador de semelhança tem com o que comparar."""
        response = self.confirm(password="davi@exemplo.com", password_confirm="davi@exemplo.com")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)  # type: ignore

    def test_a_dead_link_is_reported_before_a_weak_password(self):
        response = self.confirm(
            token="abc-0123456789abcdef", password="123", password_confirm="123"
        )

        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore
        self.assertNotIn("password", response.data)  # type: ignore

    def test_logging_in_after_the_request_kills_the_link(self):
        """
        O token inclui o último login: quem lembrou a senha e entrou não deixa
        um link vivo na caixa de entrada.
        """
        self.login(OLD_PASSWORD)

        response = self.confirm()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], INVALID_LINK_MESSAGE)  # type: ignore

    def test_open_sessions_are_revoked(self):
        refresh = self.login(OLD_PASSWORD).data["refresh"]  # type: ignore

        # O login acima matou o link do setUp (ver o teste anterior); pede outro.
        cache.clear()
        mail.outbox.clear()
        self.client.post(
            reverse("accounts:password-reset"), {"email": "davi@exemplo.com"}, format="json"
        )
        _base, self.uid, self.token = link_from(mail.outbox[0])

        self.assertEqual(self.confirm().status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
