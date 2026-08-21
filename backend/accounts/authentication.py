"""
Autenticação por JWT com as mensagens em português.

O simplejwt responde em inglês ("Token is invalid or expired", "Token is
blacklisted") e essas frases chegariam à interface do jeito que saem da
biblioteca. Aqui elas viram uma única mensagem nossa — o motivo exato do token
recusado não interessa a quem usa: em todos os casos a saída é entrar de novo.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication as BaseJWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

EXPIRED_MESSAGE = "Sessão expirada ou token inválido. Entre novamente."


def invalid_token():
    """Exceção 401 com o corpo que a interface espera: `detail` e `code`."""
    return InvalidToken({"detail": EXPIRED_MESSAGE, "code": "token_not_valid"})


class JWTAuthentication(BaseJWTAuthentication):
    def get_validated_token(self, raw_token):
        try:
            return super().get_validated_token(raw_token)
        except InvalidToken as error:
            raise invalid_token() from error
