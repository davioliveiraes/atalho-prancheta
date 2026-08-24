"""
Serializadores para aplicativo de encurtamento de URLs.

Este módulo contém todos os serializadores DRF para validação de dados, transformação e representação de URLs encurtadas e cliques.
"""

from django.utils import timezone

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .addresses import path_url, subdomain_url
from .destinations import DestinationURLField
from .models import Click, ShortenedURL
from .reserved import is_reserved, is_reserved_subdomain
from .slugs import MAX_LENGTH as MAX_SLUG_LENGTH
from .slugs import normalize_subdomain, validate_slug
from .utils import generate_short_code


class SlugField(serializers.CharField):
    """
    O apelido escolhido pelo usuário, com as regras de `slugs.py`.

    Serve aos dois campos que aceitam um: o código do caminho e o subdomínio.
    A unicidade não entra aqui porque cada um tem a sua mensagem.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("max_length", MAX_SLUG_LENGTH)
        super().__init__(**kwargs)
        self.validators.append(validate_slug)


class SubdomainField(SlugField):
    """
    O subdomínio: apelido normalizado para minúsculas, e opcional de verdade.

    Vazio e nulo significam a mesma coisa — "este link não tem subdomínio" — e
    os dois viram None antes de qualquer validação. É assim que a tela devolve
    um link ao estado de só responder no caminho.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_null", True)
        kwargs.setdefault("allow_blank", True)
        super().__init__(**kwargs)
        self.validators.append(
            UniqueValidator(
                queryset=ShortenedURL.objects.all(),
                message="Este subdominio ja esta em uso. Escolha outro.",
            )
        )
        self.validators.append(_validate_subdomain_not_reserved)

    def run_validation(self, data=serializers.empty):
        if data in ("", None):
            return None
        return super().run_validation(data)

    def to_internal_value(self, data):
        return normalize_subdomain(super().to_internal_value(data))


def _validate_subdomain_not_reserved(value):
    """
    A lista de `reserved.py` mais os nomes que o domínio usa por fora.

    `www` não disputa rota com tela nenhuma, mas um link com esse subdomínio
    deixaria o próprio site inalcançável.
    """
    if is_reserved_subdomain(value):
        raise serializers.ValidationError(
            "Este subdominio e reservado pela aplicacao. Escolha outro."
        )
    return value


class ClickSerializer(serializers.ModelSerializer):
    """
    Serializador para o modelo Click.

    Fornece uma representação somente leitura dos dados do clique, incluindo:
        Endereço IP, agente do usuário, referenciador e carimbo de data/hora.

    Campos:
        id: ID do clique
        ip_address: Endereço IP do usuário
        user_agent: Informações do navegador e do sistema operacional
        referer: URL de origem do clique
        clicked_at: Carimbo de data/hora em que o clique ocorreu
    """

    class Meta:
        model = Click
        fields = ["id", "ip_address", "user_agent", "referer", "clicked_at"]
        read_only_fields = fields


class ShortenedURLListSerializer(serializers.ModelSerializer):
    """
    Serializador para listar URLs encurtadas.

    Fornece uma visão resumida com informações essenciais e campos calculadors para exibição em listas.

    Inclui expires_at e max_clicks porque as fichas do painel precisam dos dois
    para decidir entre o bloco de números e a barra de progresso — sem eles a
    interface teria de buscar o detalhe de cada item da página.

    Campos adicionais:
        short_url: URL completa para redirecionamento
        status: Status de acesso com o indicador can_access e a mensagem
    """

    short_url = serializers.SerializerMethodField()
    subdomain_url = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = ShortenedURL
        fields = [
            "id",
            "short_code",
            "subdomain",
            "original_url",
            "short_url",
            "subdomain_url",
            "is_active",
            "expires_at",
            "max_clicks",
            "total_clicks",
            "unique_clicks",
            "status",
            "created_at",
        ]

    def get_short_url(self, obj):
        return path_url(self.context.get("request"), obj.short_code)

    def get_subdomain_url(self, obj):
        return subdomain_url(self.context.get("request"), obj.subdomain)

    def get_status(self, obj):
        can_access, message = obj.can_be_accessed()
        return {"can_access": can_access, "message": message}


class ShortenedURLDetailSerializer(serializers.ModelSerializer):
    """
    Serializador para visualização detalhada de URLs encurtadas.

    Fornece informações completas, incluindo estatísticas, cliques recentes e campos calculados.

    Campos adicionais:
        short_url: URL completa para redirecionamento
        statistics: Estatísticas de cliques e informações de status
        status: Status de acesso atual
        recent_clicks: Últimos 10 cliques nesta URL
    """

    short_url = serializers.SerializerMethodField()
    subdomain_url = serializers.SerializerMethodField()
    statistics = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    recent_clicks = serializers.SerializerMethodField()

    class Meta:
        model = ShortenedURL
        fields = [
            "id",
            "original_url",
            "short_code",
            "subdomain",
            "short_url",
            "subdomain_url",
            "is_active",
            "expires_at",
            "max_clicks",
            "total_clicks",
            "unique_clicks",
            "qr_code",
            "statistics",
            "status",
            "recent_clicks",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "short_code",
            "total_clicks",
            "unique_clicks",
            "qr_code",
            "created_at",
            "updated_at",
        ]

    def get_short_url(self, obj):
        return path_url(self.context.get("request"), obj.short_code)

    def get_subdomain_url(self, obj):
        return subdomain_url(self.context.get("request"), obj.subdomain)

    def get_statistics(self, obj):
        return {
            "total_clicks": obj.total_clicks,
            "unique_clicks": obj.unique_clicks,
            "is_expired": obj.is_expired(),
            "has_reached_max_clicks": obj.has_reached_max_clicks(),
        }

    def get_status(self, obj):
        can_access, message = obj.can_be_accessed()
        return {"can_access": can_access, "message": message}

    def get_recent_clicks(self, obj):
        recent = obj.clicks.all()[:10]
        return ClickSerializer(recent, many=True).data


def draw_short_code(length=6):
    """
    Sorteia um código livre para quem não escolheu apelido.

    `painel` tem exatamente seis caracteres: improvável não é impossível, e o
    sorteio não pode entregar a rota de ninguém.
    """
    while True:
        code = generate_short_code(length)
        if is_reserved(code):
            continue
        if not ShortenedURL.objects.filter(short_code=code).exists():
            return code


class ShortenedURLCreateSerializer(serializers.ModelSerializer):
    """
    Serializador para criação de URLs encurtadas.

    Lida com a validação de dados de entrada e geração automática de códigos curtos quando não fornecidos pelo usuário.

    Validações:
        short_code: Opcional, alfanumérico, mínimo de 3 caracteres, deve ser único
        expires_at: Deve ser uma data futura, se fornecido
        max_clicks: Deve ser positivo, se fornecido
    """

    original_url = DestinationURLField()

    # O link curto mora na raiz do dominio, junto das telas, e o subdominio ao
    # lado dos nomes que o proprio dominio usa: as duas listas de reservados
    # sao aplicadas pelos campos, em `slugs.py` e aqui em cima.
    short_code = SlugField(
        required=False,
        allow_blank=True,
        validators=[
            UniqueValidator(
                queryset=ShortenedURL.objects.all(),
                message="Este codigo curto ja esta em uso. Escolha outro.",
            )
        ],
        help_text="Apelido do caminho (opcional; sorteado quando nao informado)",
    )

    subdomain = SubdomainField(
        help_text="Apelido do subdominio (opcional)",
    )

    class Meta:
        model = ShortenedURL
        fields = ["original_url", "short_code", "subdomain", "expires_at", "max_clicks"]

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Data de expiracao deve ser no futuro")
        return value

    def validate_max_clicks(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError("Numero maximo de cliques deve ser maior que zero.")
        return value

    def create(self, validated_data):
        if not validated_data.get("short_code"):
            validated_data["short_code"] = draw_short_code()

        return super().create(validated_data)


class ShortenedURLUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador para atualização de URLs encurtadas.

    Permite a atualização de campos mutáveis, protegendo os imutáveis, como short_code e contadores de cliques.

    Campos atualizáveis:
        original_url: A URL longa original — trocar o destino é o que faz o
            mesmo endereço curto passar a levar a outro lugar
        subdomain: O apelido do subdomínio; vazio remove o subdomínio
        is_active: Status ativo/inativo
        expires_at: Data/hora de expiração
        max_clicks: Limite máximo de cliques

    `short_code` não está na lista de propósito: ele é o endereço já divulgado,
    e trocá-lo apagaria do ar todo QR Code impresso e toda mensagem enviada.

    Sem validação de `max_clicks` mínimo, ao contrário da criação: 0 é o valor
    de "sem limite" no modelo e é assim que a tela devolve um link ao estado
    ilimitado. Na criação o campo simplesmente não é enviado quando não há
    limite, então lá um 0 explícito continua sendo entrada suspeita. Negativo
    não passa nos dois casos — o campo do modelo é PositiveIntegerField.
    """

    original_url = DestinationURLField(required=False)
    subdomain = SubdomainField()

    class Meta:
        model = ShortenedURL
        fields = ["original_url", "subdomain", "is_active", "expires_at", "max_clicks"]

    def validate_expires_at(self, value):
        """
        Data nova precisa ser no futuro; a que já estava lá, não.

        Sem a segunda metade, um link já expirado ficaria impossível de editar:
        a tela de edição repõe a data atual do link ao salvar qualquer outro
        campo, e ela seria recusada por ser passado.
        """
        if not value or value == getattr(self.instance, "expires_at", None):
            return value

        if value <= timezone.now():
            raise serializers.ValidationError("Data de expiracao deve ser no futuro.")
        return value
