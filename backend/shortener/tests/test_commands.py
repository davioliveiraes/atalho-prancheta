"""Comando `adotar_links`, que dá dono aos links criados antes das contas."""

from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase

from shortener.models import ShortenedURL

User = get_user_model()


class AdotarLinksCommandTest(TestCase):
    def setUp(self):
        self.davi = User.objects.create_user(username="davi@exemplo.com", email="davi@exemplo.com")
        self.outra = User.objects.create_user(
            username="outra@exemplo.com", email="outra@exemplo.com"
        )

        self.orfao1 = ShortenedURL.objects.create(
            original_url="https://um.exemplo.com", short_code="orfao1"
        )
        self.orfao2 = ShortenedURL.objects.create(
            original_url="https://dois.exemplo.com", short_code="orfao2"
        )
        self.dela = ShortenedURL.objects.create(
            original_url="https://dela.exemplo.com", short_code="dela12", owner=self.outra
        )

    def run_command(self, *args):
        out = StringIO()
        call_command("adotar_links", *args, stdout=out)
        return out.getvalue()

    def test_adopts_every_orphan_link(self):
        output = self.run_command("davi@exemplo.com")

        self.orfao1.refresh_from_db()
        self.orfao2.refresh_from_db()
        self.assertEqual(self.orfao1.owner, self.davi)
        self.assertEqual(self.orfao2.owner, self.davi)
        self.assertIn("2 link(s)", output)

    def test_never_touches_a_link_that_already_has_an_owner(self):
        self.run_command("davi@exemplo.com")

        self.dela.refresh_from_db()
        self.assertEqual(self.dela.owner, self.outra)

    def test_adopts_only_the_given_codes(self):
        self.run_command("davi@exemplo.com", "--codigos", "orfao1")

        self.orfao1.refresh_from_db()
        self.orfao2.refresh_from_db()
        self.assertEqual(self.orfao1.owner, self.davi)
        self.assertIsNone(self.orfao2.owner)

    def test_simulation_writes_nothing(self):
        output = self.run_command("davi@exemplo.com", "--simular")

        self.orfao1.refresh_from_db()
        self.assertIsNone(self.orfao1.owner)
        self.assertIn("iriam", output)

    def test_email_is_matched_ignoring_case(self):
        self.run_command("DAVI@Exemplo.com")

        self.orfao1.refresh_from_db()
        self.assertEqual(self.orfao1.owner, self.davi)

    def test_unknown_email_stops_the_command(self):
        with self.assertRaises(CommandError):
            self.run_command("ninguem@exemplo.com")

    def test_says_when_there_is_nothing_to_adopt(self):
        ShortenedURL.objects.filter(owner__isnull=True).update(owner=self.davi)

        output = self.run_command("davi@exemplo.com")
        self.assertIn("Nenhum link sem dono", output)
