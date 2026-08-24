"""
As regras do destino — a URL para onde o atalho manda.
"""

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from shortener.destinations import (
    normalize_destination,
    points_to_a_shortlink,
    validate_destination,
)


class NormalizeDestinationTest(TestCase):
    def test_completes_the_missing_scheme(self):
        """Quem cola um endereço da barra do navegador cola sem o `https://`."""
        self.assertEqual(
            normalize_destination("chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm"),
            "https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm",
        )

    def test_keeps_the_scheme_that_came(self):
        self.assertEqual(normalize_destination("http://exemplo.com"), "http://exemplo.com")

    def test_resolves_the_scheme_relative_form(self):
        self.assertEqual(normalize_destination("//exemplo.com/a"), "https://exemplo.com/a")

    def test_trims_the_surrounding_space(self):
        self.assertEqual(normalize_destination("  exemplo.com  "), "https://exemplo.com")

    def test_keeps_the_query_string_intact(self):
        """Parâmetro de campanha é metade do motivo de encurtar um link."""
        destination = normalize_destination(
            "loja.com/promo?utm_source=whatsapp&utm_medium=grupo&utm_campaign=natal#topo"
        )
        self.assertEqual(
            destination,
            "https://loja.com/promo?utm_source=whatsapp&utm_medium=grupo&utm_campaign=natal#topo",
        )


class ValidateDestinationTest(TestCase):
    def test_accepts_a_whatsapp_group(self):
        value = "https://chat.whatsapp.com/L1k8J9xYzABcDeFgHiJkLm"
        self.assertEqual(validate_destination(value), value)

    def test_rejects_a_scheme_that_is_not_http(self):
        """O URLField do Django aceita `ftp` por padrão; este serviço não."""
        for value in ("ftp://exemplo.com/arquivo", "javascript:alert(1)"):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                validate_destination(value)

    def test_rejects_a_text_that_is_not_an_address(self):
        with self.assertRaises(ValidationError):
            validate_destination(normalize_destination("nao e uma url"))


@override_settings(SHORTLINK_BASE_DOMAIN="atalho.app")
class LoopGuardTest(TestCase):
    """
    Apontar um atalho para outro atalho monta uma volta que o navegador percorre
    até desistir.
    """

    def test_a_path_link_of_this_service_is_refused(self):
        self.assertTrue(points_to_a_shortlink("https://atalho.app/loja-natal"))
        with self.assertRaises(ValidationError):
            validate_destination("https://atalho.app/loja-natal")

    def test_a_subdomain_of_this_service_is_refused(self):
        self.assertTrue(points_to_a_shortlink("https://loja-natal.atalho.app/"))

    def test_a_screen_of_this_service_is_a_legitimate_destination(self):
        """`atalho.app/como-usar` é tela, não link: ninguém entra em volta."""
        self.assertFalse(points_to_a_shortlink("https://atalho.app/como-usar"))
        self.assertEqual(
            validate_destination("https://atalho.app/como-usar"),
            "https://atalho.app/como-usar",
        )

    def test_the_home_page_is_a_legitimate_destination(self):
        self.assertFalse(points_to_a_shortlink("https://atalho.app/"))

    def test_another_domain_passes(self):
        self.assertFalse(points_to_a_shortlink("https://chat.whatsapp.com/L1k8"))

    @override_settings(SHORTLINK_BASE_DOMAIN="")
    def test_without_a_configured_domain_there_is_nothing_to_compare(self):
        self.assertFalse(points_to_a_shortlink("https://atalho.app/loja-natal"))
