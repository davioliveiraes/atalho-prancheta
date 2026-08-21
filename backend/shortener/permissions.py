"""
Regras de acesso aos links.

Três situações, e só três:

    - Link com dono  - apenas o dono lê e altera.
    - Link sem dono  - criado na home por quem não tem conta. Qualquer um lê
      (o criador precisa disso para ver o QR Code logo depois de encurtar),
      mas ninguém altera: sem dono não há quem autorize a mudança.
    - Listagem        - é o painel de uma conta, então exige estar autenticado.
      O filtro por dono fica no `get_queryset` da view.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrReadOnlyWhenOrphan(BasePermission):
    """Permissão do ShortenedURLViewSet."""

    message = "Este link pertence a outra conta."

    def has_permission(self, request, view):
        if view.action == "list":
            return bool(request.user and request.user.is_authenticated)

        # Criar segue aberto. As rotas de detalhe passam batido aqui de
        # propósito: quem decide é has_object_permission, depois do
        # get_object() — assim um código inexistente continua respondendo 404
        # em vez de 403, que entregaria quais códigos existem.
        return True

    def has_object_permission(self, request, view, obj):
        if obj.owner_id is None:
            self.message = "Link sem dono só pode ser consultado."
            return request.method in SAFE_METHODS

        return bool(
            request.user and request.user.is_authenticated and obj.owner_id == request.user.id
        )
