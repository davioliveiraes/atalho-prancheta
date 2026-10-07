"""
O link curto por subdomínio: `loja-natal.atalho.app`.

Num acesso por subdomínio o caminho é `/` — o mesmo da página inicial —, então
quem distingue os dois é o Host, lido pelo middleware antes de o Django resolver
a URL.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from rest_framework.test import APITestCase

from shortener.middleware import extract_subdomain
from shortener.models import Click, ShortenedURL

User = get_user_model()


class ExtractSubdomainTest(TestCase):
    def test_takes_the_label_to_the_left_of_the_base(self):
        self.assertEqual(extract_subdomain("loja-natal.atalho.app", "atalho.app"), "loja-natal")

    def test_ignores_the_port_and_the_case(self):
        self.assertEqual(extract_subdomain("Loja.atalho.app:443", "atalho.app"), "loja")

    def test_the_base_domain_itself_has_no_label(self):
        self.assertIsNone(extract_subdomain("atalho.app", "atalho.app"))

    def test_two_levels_are_not_a_link(self):
        """Um link tem um rótulo só — e o certificado curinga nem cobre mais."""
        self.assertIsNone(extract_subdomain("a.b.atalho.app", "atalho.app"))

    def test_another_domain_is_not_ours(self):
        self.assertIsNone(extract_subdomain("atalho.app.exemplo.com", "atalho.app"))

    def test_without_a_base_there_is_nothing_to_extract(self):
        self.assertIsNone(extract_subdomain("loja.atalho.app", ""))


@override_settings(SHORTLINK_BASE_DOMAIN="atalho.app", ALLOWED_HOSTS=[".atalho.app"])
class SubdomainRouteTest(TestCase):
    def setUp(self):
        self.link = ShortenedURL.objects.create(
            original_url="https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm",
            short_code="aB3xY9",
            subdomain="grupowhatsempresa",
        )

    def get(self, host, path="/"):
        return self.client.get(path, HTTP_HOST=host)

    def test_the_subdomain_redirects_to_the_destination(self):
        response = self.get("grupowhatsempresa.atalho.app")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, self.link.original_url)  # type: ignore

    def test_the_subdomain_counts_the_click(self):
        self.get("grupowhatsempresa.atalho.app")

        self.link.refresh_from_db()
        self.assertEqual(self.link.total_clicks, 1)
        self.assertEqual(self.link.unique_clicks, 1)
        self.assertEqual(Click.objects.filter(url=self.link).count(), 1)

    def test_the_host_case_does_not_matter(self):
        """O navegador manda o Host em minúsculas, mas um cliente pode não mandar."""
        response = self.get("GrupoWhatsEmpresa.atalho.app")

        self.assertEqual(response.status_code, 302)

    def test_a_free_label_answers_404(self):
        response = self.get("naoexiste.atalho.app")

        self.assertEqual(response.status_code, 404)

    def test_a_reserved_label_is_not_a_link(self):
        """`www` pertence ao próprio domínio: segue adiante em vez de virar 404."""
        ShortenedURL.objects.filter(pk=self.link.pk).update(subdomain="www")

        response = self.get("www.atalho.app", "/api/health/")

        self.assertEqual(response.status_code, 200)

    def test_the_base_domain_keeps_serving_the_rest(self):
        response = self.get("atalho.app", "/api/health/")

        self.assertEqual(response.status_code, 200)

    def test_the_link_still_answers_on_the_path(self):
        """O subdomínio não substitui o caminho: os dois endereços valem."""
        response = self.get("atalho.app", "/aB3xY9")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, self.link.original_url)  # type: ignore

    def test_a_blocked_link_shows_the_block_on_the_subdomain_too(self):
        ShortenedURL.objects.filter(pk=self.link.pk).update(is_active=False)

        response = self.get("grupowhatsempresa.atalho.app")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Click.objects.filter(url=self.link).count(), 0)

    def test_changing_the_destination_changes_where_the_subdomain_leads(self):
        self.link.original_url = "https://chat.whatsapp.com/NOVOGRUPO123"
        self.link.save()

        response = self.get("grupowhatsempresa.atalho.app")

        self.assertEqual(response.url, "https://chat.whatsapp.com/NOVOGRUPO123")  # type: ignore


class SubdomainDisabledTest(TestCase):
    """Sem `SHORTLINK_BASE_DOMAIN` o middleware não olha o Host."""

    @override_settings(SHORTLINK_BASE_DOMAIN="", ALLOWED_HOSTS=["*"])
    def test_the_host_is_ignored(self):
        ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="abc123", subdomain="loja"
        )

        response = self.client.get("/api/health/", HTTP_HOST="loja.atalho.app")

        self.assertEqual(response.status_code, 200)


@override_settings(SHORTLINK_BASE_DOMAIN="atalho.app", ALLOWED_HOSTS=[".atalho.app"])
class SubdomainModelTest(TestCase):
    def test_the_subdomain_is_stored_in_lower_case(self):
        link = ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="abc123", subdomain="Loja-Natal"
        )

        link.refresh_from_db()
        self.assertEqual(link.subdomain, "loja-natal")

    def test_an_empty_subdomain_becomes_null(self):
        """
        `unique` deixa passar quantos NULL existirem, mas só um "". Sem isto, o
        segundo link sem subdomínio não entraria no banco.
        """
        first = ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="abc123", subdomain=""
        )
        second = ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="def456", subdomain=""
        )

        self.assertIsNone(first.subdomain)
        self.assertIsNone(second.subdomain)


@override_settings(SHORTLINK_BASE_DOMAIN="atalho.app", ALLOWED_HOSTS=[".atalho.app", "testserver"])
class SubdomainRenameTest(APITestCase):
    """
    O subdomínio é o nome do link, e o dono pode trocá-lo.

    O código do caminho é o endereço fixo: não muda, e é para ele que o QR Code
    aponta. É o que deixa a troca de nome sem consequência para o papel impresso.
    """

    def setUp(self):
        self.davi = User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")
        self.client.force_authenticate(self.davi)
        self.link = ShortenedURL.objects.create(
            original_url="https://google.com",
            short_code="aB3xY9",
            subdomain="wppdavi",
            owner=self.davi,
            qr_code="qrcodes/aB3xY9.png",
        )

    def rename(self, **data):
        return self.client.patch("/api/urls/aB3xY9/", data, format="json")

    def visit(self, host, path="/"):
        return self.client.get(path, HTTP_HOST=host)

    def test_the_new_name_answers_and_the_old_one_stops(self):
        response = self.rename(subdomain="wppdavi-novo")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.visit("wppdavi-novo.atalho.app").status_code, 302)
        self.assertEqual(self.visit("wppdavi.atalho.app").status_code, 404)

    def test_the_fixed_address_and_the_qr_code_do_not_change(self):
        self.rename(subdomain="wppdavi-novo")

        self.link.refresh_from_db()
        self.assertEqual(self.link.short_code, "aB3xY9")
        self.assertEqual(self.link.qr_code.name, "qrcodes/aB3xY9.png")
        self.assertEqual(self.visit("atalho.app", "/aB3xY9").status_code, 302)

    def test_name_and_destination_change_together(self):
        """O caso do grupo: nasce apontando para um lugar provisório, e depois tudo muda."""
        self.rename(subdomain="grupo-davi", original_url="https://chat.whatsapp.com/GRUPO123")

        response = self.visit("grupo-davi.atalho.app")

        self.assertEqual(response.url, "https://chat.whatsapp.com/GRUPO123")  # type: ignore

    def test_another_links_name_is_not_available(self):
        ShortenedURL.objects.create(
            original_url="https://exemplo.com", short_code="outro1", subdomain="ocupado"
        )

        response = self.rename(subdomain="ocupado")

        self.assertEqual(response.status_code, 400)
        self.assertIn("subdomain", response.data)  # type: ignore
        self.link.refresh_from_db()
        self.assertEqual(self.link.subdomain, "wppdavi")

    def test_keeping_the_same_name_is_not_a_conflict_with_itself(self):
        response = self.rename(subdomain="wppdavi", original_url="https://exemplo.com/novo")

        self.assertEqual(response.status_code, 200)

    def test_a_name_with_capitals_is_stored_in_lower_case(self):
        """O navegador manda o Host em minúsculas: `wppDavi` e `wppdavi` são o mesmo endereço."""
        self.rename(subdomain="wppDavi2")

        self.link.refresh_from_db()
        self.assertEqual(self.link.subdomain, "wppdavi2")
        self.assertEqual(self.visit("WppDavi2.atalho.app").status_code, 302)

    def test_clearing_the_name_leaves_only_the_fixed_address(self):
        self.rename(subdomain="")

        self.link.refresh_from_db()
        self.assertIsNone(self.link.subdomain)
        self.assertEqual(self.visit("wppdavi.atalho.app").status_code, 404)
        self.assertEqual(self.visit("atalho.app", "/aB3xY9").status_code, 302)

    def test_the_panel_search_finds_the_link_by_its_name(self):
        response = self.client.get("/api/urls/", {"search": "wppd"})

        self.assertEqual(response.data["count"], 1)  # type: ignore
