"""
Dá dono aos links que ficaram sem um.

Todo link criado antes de existir conta é órfão: continua redirecionando, mas
não aparece em painel nenhum, porque o painel lista por dono. Este comando
transfere esses links para uma conta.

    python manage.py adotar_links voce@exemplo.com
    python manage.py adotar_links voce@exemplo.com --codigos abc123 def456
    python manage.py adotar_links voce@exemplo.com --simular
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from shortener.models import ShortenedURL

User = get_user_model()


class Command(BaseCommand):
    help = "Atribui os links sem dono a uma conta existente."

    def add_arguments(self, parser):
        parser.add_argument("email", help="E-mail da conta que vai receber os links")
        parser.add_argument(
            "--codigos",
            nargs="+",
            metavar="CODIGO",
            help="Adota apenas estes códigos curtos (padrão: todos os órfãos)",
        )
        parser.add_argument(
            "--simular",
            action="store_true",
            help="Mostra o que seria feito sem gravar nada",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist as error:
            raise CommandError(f"Nenhuma conta com o e-mail {email}.") from error

        # Só órfãos: link de outra conta não é adotado por engano.
        links = ShortenedURL.objects.filter(owner__isnull=True)
        if options["codigos"]:
            links = links.filter(short_code__in=options["codigos"])

        codes = list(links.values_list("short_code", flat=True))

        if not codes:
            self.stdout.write("Nenhum link sem dono para adotar.")
            return

        if options["simular"]:
            self.stdout.write(f"{len(codes)} link(s) iriam para {email}: {', '.join(codes)}")
            return

        adopted = links.update(owner=user)
        self.stdout.write(
            self.style.SUCCESS(f"{adopted} link(s) agora pertencem a {email}: {', '.join(codes)}")
        )
