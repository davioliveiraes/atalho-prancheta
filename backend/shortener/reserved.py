"""
Nomes que a raiz não pode entregar a um link.

Desde que o link curto responde em `/{codigo}`, a raiz do domínio é dividida
entre os links e as telas da interface. Um link com o código `painel` deixaria
o painel inalcançável — então esses nomes não viram código.

Outras duas partes precisam conhecer esta lista, porque decidem o que vai para
o backend e o que vai para a interface antes de qualquer código Python rodar:

    - deploy/nginx/default.conf.template  (produção)
    - frontend/vite.config.ts             (desenvolvimento)

Nenhum dos dois tem como consultar esta lista em tempo de execução: mexeu aqui,
mexa nos dois.
"""

RESERVED_CODES = frozenset(
    {
        # Telas da interface
        "painel",
        "links",
        "entrar",
        "criar-conta",
        "como-usar",
        "referencia",
        "api",
        # Servidas pelo backend
        "admin",
        "static",
        "media",
        # Prefixo antigo do redirecionamento, mantido para os links já divulgados
        "r",
    }
)


def is_reserved(code):
    """Sem diferenciar maiúsculas: `Painel` roubaria a rota igualzinho."""
    return code.lower() in RESERVED_CODES


def reserved_alternation():
    """
    `admin|api|criar-conta|...` — o miolo da exclusão usada no roteamento.

    A rota da raiz monta a sua a partir daqui. O nginx e o Vite carregam uma
    cópia literal, porque decidem o destino antes de existir processo Python.
    """
    return "|".join(sorted(RESERVED_CODES))


# O subdomínio tem uma segunda lista, além da de cima.
#
# `www.atalho.app` e `mail.atalho.app` não disputam rota com tela nenhuma — o
# problema é outro: são nomes que a infraestrutura do domínio usa ou vai usar, e
# um link que os tomasse deixaria o site ou o e-mail inalcançável.
RESERVED_SUBDOMAINS = RESERVED_CODES | frozenset(
    {
        "www",
        "app",
        "mail",
        "smtp",
        "imap",
        "pop",
        "ftp",
        "ns1",
        "ns2",
        "mx",
        "cdn",
        "assets",
        "blog",
        "status",
        "suporte",
        "docs",
        "dev",
        "staging",
        "test",
        "localhost",
    }
)


def is_reserved_subdomain(label):
    """Vale a lista dos códigos mais os nomes que o próprio domínio precisa."""
    return label.lower() in RESERVED_SUBDOMAINS
