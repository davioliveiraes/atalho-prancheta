"""
Serializadores de conta.

O modelo de usuário é o padrão do Django. O e-mail é a credencial visível e o
campo `username` guarda o mesmo e-mail, normalizado — assim `authenticate()`
continua funcionando sem trocar o AUTH_USER_MODEL.
"""

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

# `username` do Django aceita 150 caracteres; o e-mail cabe em 254. Como um vira
# o outro, o limite do username é o que vale no cadastro.
EMAIL_MAX_LENGTH = 150


def normalize_email(value):
    """
    E-mail sempre em minúsculas.

    A parte local é sensível a maiúsculas pela RFC, mas nenhum provedor usado na
    prática distingue — e guardar em caixa única evita duas contas para o mesmo
    endereço e faz o login funcionar independentemente de como foi digitado.
    """
    return value.strip().lower()


class UserSerializer(serializers.ModelSerializer):
    """Representação pública da conta — nunca inclui senha ou permissões."""

    name = serializers.CharField(source="first_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "date_joined"]
        read_only_fields = fields


class RegisterSerializer(serializers.ModelSerializer):
    """
    Cadastro por e-mail e senha.

    Validações:
        email: obrigatório, único (sem diferenciar maiúsculas), até 150 caracteres
        password: passa pelos validadores de senha do Django (AUTH_PASSWORD_VALIDATORS)
        password_confirm: precisa ser igual a password
        name: opcional, guardado em first_name
    """

    email = serializers.EmailField(max_length=EMAIL_MAX_LENGTH, required=True)
    name = serializers.CharField(
        source="first_name", required=False, allow_blank=True, max_length=150
    )
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "name", "email", "password", "password_confirm"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = normalize_email(value)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return email

    def validate_password(self, value):
        # O validador do Django devolve uma lista de mensagens; o DRF espera as
        # dele, então a exceção é traduzida aqui em vez de virar erro 500.
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "As senhas não conferem."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]

        return User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=validated_data.get("first_name", ""),
        )


# Serializador de validacao pura: nao cria nem atualiza objeto, entao create()
# e update() do BaseSerializer nao tem o que implementar.
# pylint: disable=abstract-method
class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login por e-mail.

    O serializador do simplejwt pergunta pelo USERNAME_FIELD, que no modelo
    padrão é `username`. Aqui o campo declarado é `email` e a autenticação usa o
    e-mail normalizado como username — que é exatamente o que o cadastro grava.
    """

    username_field = "email"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"] = serializers.EmailField(max_length=EMAIL_MAX_LENGTH)
        self.fields["password"] = serializers.CharField(
            write_only=True, style={"input_type": "password"}
        )

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=normalize_email(attrs.get("email", "")),
            password=attrs.get("password", ""),
        )

        # Mesma mensagem para e-mail inexistente e senha errada: dizer qual dos
        # dois falhou revelaria quem tem conta na aplicação.
        if user is None:
            raise serializers.ValidationError(
                {"detail": "E-mail ou senha incorretos."}, code="authorization"
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "Esta conta está desativada."}, code="authorization"
            )

        refresh = self.get_token(user)

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
