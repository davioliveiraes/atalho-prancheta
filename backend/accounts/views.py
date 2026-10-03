"""
Endpoints de conta.

    - POST /api/auth/register/  - cria a conta e já devolve o par de tokens
    - POST /api/auth/login/     - troca e-mail e senha pelo par de tokens
    - POST /api/auth/refresh/   - renova o access a partir do refresh
    - POST /api/auth/logout/    - invalida o refresh recebido
    - GET  /api/auth/me/        - conta do token atual
    - POST /api/auth/password-reset/          - manda o link de redefinição
    - POST /api/auth/password-reset/confirm/  - troca a senha pelo link
"""

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .authentication import invalid_token
from .password_reset import request_message, request_reset, revoke_sessions
from .serializers import (
    EmailTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


def token_pair(user):
    """Par de tokens mais a conta — mesmo corpo devolvido pelo cadastro e pelo login."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),  # type: ignore[attr-defined]
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


class RegisterView(generics.CreateAPIView):
    """Cadastro aberto. Responde 201 com os tokens para a interface já entrar."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(token_pair(user), status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """Login por e-mail e senha."""

    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-login"


class RefreshView(TokenRefreshView):
    """Renovação do access. Com a rotação ligada, devolve também um refresh novo."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-refresh"

    def post(self, request, *args, **kwargs):
        # Refresh vencido, rotacionado ou na blacklist sai daqui com a mesma
        # mensagem do access recusado, em vez do texto em inglês da biblioteca.
        try:
            return super().post(request, *args, **kwargs)
        except InvalidToken as error:
            raise invalid_token() from error


class LogoutView(APIView):
    """
    Encerra a sessão invalidando o refresh na blacklist.

    O access continua válido até expirar — é a natureza de um token assinado.
    Por isso o tempo de vida dele é curto (ver SIMPLE_JWT em settings).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if not token:
            return Response(
                {"refresh": ["Informe o token de atualização."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(token).blacklist()
        except TokenError:
            return Response(
                {"detail": "Token de atualização inválido ou já expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveAPIView):
    """Conta dona do access token enviado no cabeçalho Authorization."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    """
    Pede o link de redefinição.

    Responde 200 com a mesma frase exista ou não a conta, e no mesmo tempo: o
    e-mail sai fora da requisição (ver PASSWORD_RESET_EMAIL_IN_BACKGROUND).
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-password-reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_reset(serializer.validated_data["email"])  # type: ignore[index]
        return Response({"detail": request_message()})


class PasswordResetConfirmView(APIView):
    """
    Troca a senha com o `uid` e o `token` do link.

    Aberta: quem chega aqui, por definição, não consegue entrar. Responde 204 e
    não devolve tokens — a interface manda para a tela de entrar, e a primeira
    coisa feita com a senha nova é usá-la.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth-password-confirm"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]  # type: ignore[index]
        user.set_password(serializer.validated_data["password"])  # type: ignore[index]
        user.save(update_fields=["password"])
        revoke_sessions(user)

        return Response(status=status.HTTP_204_NO_CONTENT)
