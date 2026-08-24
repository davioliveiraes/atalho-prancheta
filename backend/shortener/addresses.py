"""
Os endereços divulgáveis de um link.

Um link tem sempre um endereço de caminho — `atalho.app/loja-natal` — e,
quando o dono escolheu um subdomínio, um segundo — `loja-natal.atalho.app`.
Os dois levam ao mesmo destino e contam o mesmo clique.

O domínio-base vem de `SHORTLINK_BASE_DOMAIN`, a mesma chave que liga o
middleware. Sem ela, o endereço de subdomínio é `None` — anunciar um endereço
que ninguém atende seria pior do que não mostrar nenhum.

Em desenvolvimento, `SHORTLINK_BASE_DOMAIN=localhost:8000` é o suficiente para
experimentar: o navegador resolve `qualquercoisa.localhost` sozinho, sem mexer
no arquivo de hosts.
"""

from django.conf import settings


def base_domain():
    """O domínio sob o qual os subdomínios respondem, com a porta quando houver."""
    return (getattr(settings, "SHORTLINK_BASE_DOMAIN", "") or "").strip().lower().lstrip(".")


def base_hostname():
    """
    O mesmo domínio sem a porta.

    É a forma que serve para comparar com um Host — o Django tira a porta antes
    de conferir o ALLOWED_HOSTS, e `urlsplit(...).hostname` também não a traz.
    """
    return base_domain().split(":")[0]


def path_url(request, short_code):
    """`https://atalho.app/loja-natal` — o endereço que todo link tem."""
    if request is None:
        return f"/{short_code}"
    return request.build_absolute_uri(f"/{short_code}")


def subdomain_url(request, subdomain):
    """`https://loja-natal.atalho.app`, ou None quando o link não tem subdomínio."""
    if not subdomain:
        return None

    domain = base_domain()
    if not domain:
        return None

    scheme = request.scheme if request is not None else "https"
    return f"{scheme}://{subdomain}.{domain}"
