from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.authentication import EXPIRED_MESSAGE

User = get_user_model()

VALID_PASSWORD = "prancheta-2026-forte"


class RegisterTest(APITestCase):
    def setUp(self):
        # O throttle guarda a contagem em cache entre os testes.
        cache.clear()
        self.url = reverse("accounts:register")

    def payload(self, **overrides):
        data = {
            "email": "davi@exemplo.com",
            "password": VALID_PASSWORD,
            "password_confirm": VALID_PASSWORD,
        }
        data.update(overrides)
        return data

    def test_register_creates_user_and_returns_tokens(self):
        response = self.client.post(self.url, self.payload(name="Davi"), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)  # type: ignore
        self.assertIn("refresh", response.data)  # type: ignore
        self.assertEqual(response.data["user"]["email"], "davi@exemplo.com")  # type: ignore
        self.assertEqual(response.data["user"]["name"], "Davi")  # type: ignore

        user = User.objects.get(email="davi@exemplo.com")
        # O username espelha o e-mail para que authenticate() funcione sem
        # trocar o AUTH_USER_MODEL.
        self.assertEqual(user.username, "davi@exemplo.com")
        self.assertTrue(user.check_password(VALID_PASSWORD))

    def test_register_never_returns_the_password(self):
        response = self.client.post(self.url, self.payload(), format="json")
        self.assertNotIn("password", response.data)  # type: ignore

    def test_register_normalizes_email_case(self):
        response = self.client.post(self.url, self.payload(email="Davi@Exemplo.com"), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="davi@exemplo.com").exists())

    def test_register_rejects_duplicate_email_ignoring_case(self):
        User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")

        response = self.client.post(self.url, self.payload(email="DAVI@exemplo.com"), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)  # type: ignore
        self.assertEqual(User.objects.count(), 1)

    def test_register_rejects_password_mismatch(self):
        response = self.client.post(
            self.url, self.payload(password_confirm="outra-senha-qualquer"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)  # type: ignore

    def test_register_applies_django_password_validators(self):
        response = self.client.post(
            self.url, self.payload(password="123", password_confirm="123"), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)  # type: ignore
        self.assertFalse(User.objects.exists())

    def test_register_rejects_invalid_email(self):
        response = self.client.post(self.url, self.payload(email="nao-e-email"), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)  # type: ignore


class LoginTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("accounts:login")
        self.user = User.objects.create_user(
            username="davi@exemplo.com",
            email="davi@exemplo.com",
            password=VALID_PASSWORD,
        )

    def test_login_returns_token_pair(self):
        response = self.client.post(
            self.url, {"email": "davi@exemplo.com", "password": VALID_PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)  # type: ignore
        self.assertIn("refresh", response.data)  # type: ignore
        self.assertEqual(response.data["user"]["email"], "davi@exemplo.com")  # type: ignore

    def test_login_records_the_last_login(self):
        """
        O `validate` próprio deixava UPDATE_LAST_LOGIN sem efeito. O campo
        também entra no token de redefinição de senha.
        """
        self.assertIsNone(self.user.last_login)

        self.client.post(
            self.url, {"email": "davi@exemplo.com", "password": VALID_PASSWORD}, format="json"
        )

        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_login_accepts_email_in_any_case(self):
        response = self.client.post(
            self.url, {"email": "DAVI@Exemplo.com", "password": VALID_PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_rejects_wrong_password(self):
        response = self.client.post(
            self.url, {"email": "davi@exemplo.com", "password": "senha-errada"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("access", response.data)  # type: ignore

    def test_login_hides_whether_the_account_exists(self):
        """E-mail inexistente e senha errada devolvem a mesma mensagem."""
        unknown = self.client.post(
            self.url, {"email": "ninguem@exemplo.com", "password": VALID_PASSWORD}, format="json"
        )
        wrong = self.client.post(
            self.url, {"email": "davi@exemplo.com", "password": "senha-errada"}, format="json"
        )

        self.assertEqual(unknown.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(unknown.data), str(wrong.data))  # type: ignore

    def test_login_rejects_inactive_account(self):
        self.user.is_active = False
        self.user.save()

        response = self.client.post(
            self.url, {"email": "davi@exemplo.com", "password": VALID_PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SessionTest(APITestCase):
    """Rotas que dependem do token: me, refresh e logout."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="davi@exemplo.com",
            email="davi@exemplo.com",
            password=VALID_PASSWORD,
        )
        response = self.client.post(
            reverse("accounts:login"),
            {"email": "davi@exemplo.com", "password": VALID_PASSWORD},
            format="json",
        )
        self.access = response.data["access"]  # type: ignore
        self.refresh = response.data["refresh"]  # type: ignore

    def authenticate(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")

    def test_me_requires_a_token(self):
        response = self.client.get(reverse("accounts:me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_the_token_owner(self):
        self.authenticate()
        response = self.client.get(reverse("accounts:me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "davi@exemplo.com")  # type: ignore
        self.assertEqual(response.data["id"], self.user.id)  # type: ignore

    def test_me_rejects_a_garbage_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer nao-e-um-token")
        response = self.client.get(reverse("accounts:me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        # O texto do simplejwt e em ingles; quem responde aqui e a nossa classe.
        self.assertEqual(response.data["detail"], EXPIRED_MESSAGE)  # type: ignore

    def test_refresh_rejects_a_garbage_token_in_portuguese(self):
        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": "nao-e-um-token"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], EXPIRED_MESSAGE)  # type: ignore

    def test_refresh_returns_a_new_access(self):
        response = self.client.post(
            reverse("accounts:refresh"), {"refresh": self.refresh}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)  # type: ignore
        # Com ROTATE_REFRESH_TOKENS o refresh tambem e trocado.
        self.assertIn("refresh", response.data)  # type: ignore

    def test_refresh_rejects_the_rotated_token(self):
        first = self.client.post(
            reverse("accounts:refresh"), {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        again = self.client.post(
            reverse("accounts:refresh"), {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(again.data["detail"], EXPIRED_MESSAGE)  # type: ignore

    def test_logout_requires_authentication(self):
        response = self.client.post(
            reverse("accounts:logout"), {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_the_refresh(self):
        self.authenticate()
        response = self.client.post(
            reverse("accounts:logout"), {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.client.credentials()
        reuse = self.client.post(
            reverse("accounts:refresh"), {"refresh": self.refresh}, format="json"
        )
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_without_refresh_is_a_bad_request(self):
        self.authenticate()
        response = self.client.post(reverse("accounts:logout"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PublicEndpointsTest(APITestCase):
    """A autenticacao entrou sem fechar o encurtador publico da home."""

    def setUp(self):
        cache.clear()

    def test_anonymous_can_still_shorten_a_link(self):
        created = self.client.post(
            reverse("shortened-url-list"), {"original_url": "https://exemplo.com"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        # E consegue reabrir o que acabou de criar, para copiar e ver o QR Code.
        code = created.data["short_code"]  # type: ignore
        detail = self.client.get(reverse("shortened-url-detail", kwargs={"short_code": code}))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

    def test_listing_links_now_belongs_to_an_account(self):
        response = self.client.get(reverse("shortened-url-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
