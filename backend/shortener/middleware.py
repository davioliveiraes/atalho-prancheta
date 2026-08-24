"""
O link curto por subdomínio: `loja-natal.atalho.app`.

Precisa ser middleware e não rota porque, num acesso por subdomínio, o caminho
é `/` — o mesmo caminho da página inicial. Quem distingue os dois é o Host, e o
Host só é lido antes de o Django resolver a URL.

O que não for um subdomínio de link segue adiante intacto: o domínio-base
(`atalho.app`), o `www`, os nomes da lista de reservados e qualquer Host que não
termine no domínio configurado. Sem `SHORTLINK_BASE_DOMAIN` o middleware não faz
nada — é o que mantém a suíte de testes e a venv local funcionando sem
configuração nenhuma.

Infraestrutura, do lado de fora: um registro DNS curinga (`*.atalho.app`), um
certificado curinga e o `server_name` do nginx aceitando o curinga. Sem os três,
o subdomínio não chega até aqui. Está descrito em DEPLOY.md.
"""

from django.conf import settings

from .models import ShortenedURL
from .reserved import is_reserved_subdomain
from .resolver import blocked_response, serve_link
from .slugs import SLUG_PATTERN


def extract_subdomain(host, base_domain):
    """
    O rótulo à esquerda do domínio-base, ou None.

    `loja.atalho.app` com base `atalho.app` dá `loja`. O próprio `atalho.app` dá
    None, e `a.b.atalho.app` também — um link tem um rótulo só, e aceitar mais
    de um seria inventar endereço que o certificado curinga nem cobre.
    """
    host = (host or "").split(":")[0].lower().rstrip(".")
    base = (base_domain or "").split(":")[0].lower().strip(".")

    if not base or not host.endswith(f".{base}"):
        return None

    label = host[: -len(base) - 1]
    if "." in label:
        return None

    return label or None


class SubdomainRedirectMiddleware:
    """Resolve o link pelo subdomínio antes de qualquer rota ser consultada."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        link = self._resolve(request)

        if link is None:
            return self.get_response(request)

        url, label = link
        if url is None:
            return blocked_response(request, "not_found", label, 404)

        return serve_link(request, url, label)

    def _resolve(self, request):
        """Devolve (link, rótulo), (None, rótulo) para rótulo livre, ou None."""
        base_domain = (getattr(settings, "SHORTLINK_BASE_DOMAIN", "") or "").strip()
        if not base_domain:
            return None

        label = extract_subdomain(request.get_host(), base_domain)
        if label is None:
            return None

        # `www` e companhia pertencem ao próprio domínio: nunca foram link, e
        # responder 404 neles esconderia o site de quem digitou o endereço com
        # o `www` na frente.
        if is_reserved_subdomain(label) or not SLUG_PATTERN.match(label):
            return None

        return ShortenedURL.objects.filter(subdomain=label).first(), label
