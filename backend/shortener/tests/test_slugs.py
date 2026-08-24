"""
As regras de um apelido — o texto que responde em `/{apelido}` e em
`{apelido}.dominio`.
"""

from django.core.exceptions import ValidationError
from django.test import TestCase

from shortener.slugs import (
    MAX_LENGTH,
    normalize_subdomain,
    shortlink_path_regex,
    validate_slug,
)


class ValidateSlugTest(TestCase):
    def assertRejected(self, value):
        with self.assertRaises(ValidationError):
            validate_slug(value)

    def test_accepts_a_readable_name(self):
        self.assertEqual(validate_slug("grupowhatsempresa"), "grupowhatsempresa")

    def test_accepts_the_hyphen_in_the_middle(self):
        """`loja-natal` é o formato que um link divulgado costuma ter."""
        self.assertEqual(validate_slug("loja-natal"), "loja-natal")

    def test_accepts_the_drawn_code(self):
        self.assertEqual(validate_slug("aB3xY9"), "aB3xY9")

    def test_rejects_fewer_than_three_characters(self):
        self.assertRejected("ab")

    def test_rejects_more_than_the_ceiling(self):
        self.assertRejected("a" * (MAX_LENGTH + 1))

    def test_accepts_exactly_the_ceiling(self):
        value = "a" * MAX_LENGTH
        self.assertEqual(validate_slug(value), value)

    def test_rejects_an_accent(self):
        """
        `str.isalnum()` aceitava `café` — e um acento no caminho vira `%C3%A9`
        no endereço divulgado, além de não existir em rótulo DNS.
        """
        self.assertRejected("café")

    def test_rejects_a_space_and_an_underscore(self):
        self.assertRejected("loja natal")
        self.assertRejected("loja_natal")

    def test_rejects_a_hyphen_at_the_edges(self):
        self.assertRejected("-loja")
        self.assertRejected("loja-")

    def test_rejects_two_hyphens_in_a_row(self):
        """`xn--` é o prefixo que o DNS reserva para nome internacionalizado."""
        self.assertRejected("xn--loja")
        self.assertRejected("loja--natal")

    def test_rejects_a_reserved_name(self):
        self.assertRejected("painel")
        self.assertRejected("Painel")


class NormalizeSubdomainTest(TestCase):
    def test_lowercases_and_trims(self):
        self.assertEqual(normalize_subdomain("  Loja-Natal "), "loja-natal")

    def test_empty_stays_empty(self):
        self.assertEqual(normalize_subdomain(None), "")
        self.assertEqual(normalize_subdomain("   "), "")


class ShortlinkPathRegexTest(TestCase):
    """
    O padrão que a rota da raiz usa — e que o nginx e o Vite copiam.

    O que quebrar aqui quebra o roteamento nas três cópias de uma vez.
    """

    def setUp(self):
        import re

        self.pattern = re.compile(rf"^{shortlink_path_regex()}$")

    def test_matches_an_alias(self):
        self.assertIsNotNone(self.pattern.match("loja-natal"))
        self.assertIsNotNone(self.pattern.match("grupowhatsempresa"))

    def test_does_not_match_a_screen(self):
        self.assertIsNone(self.pattern.match("painel"))
        self.assertIsNone(self.pattern.match("criar-conta"))

    def test_a_screen_name_with_a_suffix_is_a_legitimate_alias(self):
        self.assertIsNotNone(self.pattern.match("painelx"))
