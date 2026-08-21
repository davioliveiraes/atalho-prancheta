"""
Endpoint de saúde.

Existe para quem orquestra: o healthcheck do Compose, um monitor de
disponibilidade, um balanceador. Antes o healthcheck perguntava por
`/api/urls/`, que desde a posse dos links responde 401 a quem não tem conta — o
container ficava marcado como doente estando perfeitamente de pé.
"""

from django.db import Error as DatabaseError
from django.db import connection
from django.http import JsonResponse


def health(_request):
    """
    200 com o banco respondendo, 503 sem ele.

    Não exige conta, porque quem pergunta é máquina, e não conta nada sobre o
    conteúdo da aplicação — só se ela consegue trabalhar.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "sem banco"}, status=503)

    return JsonResponse({"status": "ok"})
