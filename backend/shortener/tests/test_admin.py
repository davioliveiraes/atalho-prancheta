from django.contrib.admin.sites import AdminSite
from django.test import TestCase

from shortener.admin import ClickAdmin, ShortenedURLAdmin
from shortener.models import Click, ShortenedURL


class ShortenedURLAdminTest(TestCase):
    def setUp(self):
        self.admin = ShortenedURLAdmin(ShortenedURL, AdminSite())
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="admin1",
        )

    def _add_clicks(self, quantity):
        for index in range(quantity):
            Click.objects.create(
                url=self.url,
                ip_address=f"10.0.0.{index}",
                user_agent="Mozilla/5.0",
            )

    def test_recent_clicks_display_without_clicks(self):
        html = self.admin.recent_clicks_display(self.url)
        self.assertIn("Nenhum clique registrado ainda", html)

    def test_recent_clicks_display_lists_clicks(self):
        self._add_clicks(3)
        html = self.admin.recent_clicks_display(self.url)
        self.assertIn("10.0.0.0", html)
        self.assertIn("10.0.0.2", html)
        self.assertNotIn("Mostrando 10 de", html)

    def test_recent_clicks_display_counts_beyond_ten(self):
        # Regressao: o rodape usava obj.Clicks (o related_name e clicks) e
        # quebrava a pagina de edicao de qualquer URL com mais de 10 cliques.
        self._add_clicks(11)
        html = self.admin.recent_clicks_display(self.url)
        self.assertIn("Mostrando 10 de 11 cliques totais", html)

    # As colunas abaixo entram na listagem: um retorno que levanta excecao
    # derruba a pagina inteira, nao apenas a celula.
    def test_qr_preview_without_qr_code(self):
        self.assertIn("Sem QR", self.admin.qr_preview(self.url))

    def test_qr_code_large_without_qr_code(self):
        self.assertIn("QR Code não gerado", self.admin.qr_code_large(self.url))

    def test_status_badge_active(self):
        self.assertIn("Ativo", self.admin.status_badge(self.url))

    def test_status_badge_inactive(self):
        self.url.is_active = False
        self.assertIn("Inativo", self.admin.status_badge(self.url))

    def test_click_stats_without_max_clicks(self):
        self.assertIn("total", self.admin.click_stats(self.url))

    def test_access_status_display(self):
        self.assertIn("Acessível", self.admin.access_status_display(self.url))


class ClickAdminTest(TestCase):
    def setUp(self):
        self.admin = ClickAdmin(Click, AdminSite())
        self.url = ShortenedURL.objects.create(
            original_url="https://example.com",
            short_code="admin2",
        )
        self.click = Click.objects.create(
            url=self.url,
            ip_address="10.0.0.1",
            user_agent="Mozilla/5.0",
        )

    def test_referer_display_without_referer(self):
        self.assertIn("-", self.admin.referer_display(self.click))

    def test_referer_display_with_referer(self):
        self.click.referer = "https://origem.com"
        self.assertIn("https://origem.com", self.admin.referer_display(self.click))

    def test_user_agent_formatted_without_user_agent(self):
        self.click.user_agent = ""
        self.assertIn("Não disponível", self.admin.user_agent_formatted(self.click))

    def test_user_agent_formatted_with_user_agent(self):
        self.assertIn("Mozilla/5.0", self.admin.user_agent_formatted(self.click))
