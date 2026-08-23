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
