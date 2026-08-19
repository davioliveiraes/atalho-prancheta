"""
Modelos para aplicação de encurtamento de URLs

Este módulo define os modelos de banco de dados para URLs encurtadas e rastreamento de cliques.
"""

from django.db import models
from django.utils import timezone


class ShortenedURL(models.Model):
    """
    Modelo representando uma URL encurtada.

    Atributos:
        original_url(str): A URL longa original a ser encurtada.
        short_code (str): O código curto exclusivo da URL.
        is_active (bool): Indica se a URL encurtada está ativa.
        expires_at (datetime): Data/hora de expiração opcional para a URL.
        max_clicks (int): Número máximo de cliques únicos permitidos (0 = ilimitado).
        total_clicks (int): Número total de cliques recebidos
        unique_clicks (int): Número de cliques únicos (com base no endereço IP).
        qr_code (ImageField): Imagem do código QR gerada automaticamente.
        created_at (datetime): Data e hora em que a URL foi criada.
        updated_at (datetime): Data e hora em que a URL foi atualizada pela última vez.
    """

    original_url = models.URLField(
        verbose_name="URL Original",
        max_length=2048,
        help_text="URL completa que sera encurtada",
    )

    short_code = models.CharField(
        verbose_name="Codigo Curto",
        max_length=10,
        unique=True,
        db_index=True,
        help_text="Codigo unico para a URL encurtada",
    )

    is_active = models.BooleanField(
        default=True, verbose_name="Ativo", help_text="Define se o link esta ativo"
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Expira em",
        help_text="Data e hora de expiracao do link",
    )

    max_clicks = models.PositiveIntegerField(
        default=0,
        verbose_name="Maximo de Cliques unicos",
        help_text="Numero maximo de cliques unicos permitidos",
    )

    total_clicks = models.PositiveIntegerField(
        default=0,
        verbose_name="Total de Cliques",
        help_text="Contador total de cliques",
    )

    unique_clicks = models.PositiveIntegerField(
        default=0,
        verbose_name="Cliques Unicos",
        help_text="Contador de cliques unicos (baseadoem IP)",
    )

    qr_code = models.ImageField(
        upload_to="qrcodes/",
        null=True,
        blank=True,
        verbose_name="QR Code",
        help_text="Imagem do QR Code gerado automaticamente",
    )

    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Criado em", help_text="Data de criacao"
    )

    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Atualizado em", help_text="Data da utlima atualizacao"
    )

    class Meta:
        verbose_name = "URL Encurtada"
        verbose_name_plural = "URLs Encurtadas"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["short_code"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.short_code} -> {self.original_url}"

    def is_expired(self):
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        return False

    def has_reached_max_clicks(self):
        if not self.max_clicks or self.max_clicks == 0:
            return False
        return self.unique_clicks >= self.max_clicks

    def can_be_accessed(self):
        if not self.is_active:
            return False, "Link inativo"
        if self.is_expired():
            return False, "Link expirado"
        if self.has_reached_max_clicks():
            return False, "Limite de cliques atingido"
        return True, "OK"

    def increment_clicks(self, is_unique=False):
        self.total_clicks += 1
        if is_unique:
            self.unique_clicks += 1
        self.save(update_fields=["total_clicks", "unique_clicks"])


class Click(models.Model):
    """
    Modelo que representa um clique em uma URL encurtada.

    Atributos:
        url (ForeignKey): Referência à URL encurtada clicada.
        ip_address(str): Endereço IP do usuário que clicou.
        user_agent(str): Informações do navegador e do sistema operacional do usuário.
        referer (str): URL de origem do clique.
        clicked_at (datetime): Data e hora em que o clique ocorreu
    """

    url = models.ForeignKey(
        ShortenedURL,
        on_delete=models.CASCADE,
        related_name="clicks",
        verbose_name="URL",
        help_text="URL encurtada que foi clicada",
    )

    ip_address = models.GenericIPAddressField(
        verbose_name="Endereco IP", help_text="IP do usuario que clicou"
    )

    user_agent = models.TextField(
        blank=True, verbose_name="User Agent", help_text="Navegador e sistema operacional"
    )

    referer = models.URLField(
        blank=True,
        null=True,
        max_length=2048,
        verbose_name="Referencia",
        help_text="URL de onde veio o clique",
    )

    clicked_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Clicando em",
        help_text="Data e hora do clique",
    )

    class Meta:
        verbose_name = ("Clique",)
        verbose_name_plural = "Cliques"
        ordering = ["-clicked_at"]
        indexes = [
            models.Index(fields=["url", "ip_address"]),
            models.Index(fields=["clicked_at"]),
            models.Index(fields=["url", "clicked_at"]),
        ]

    def __str__(self):
        return f"Clique em {self.url.short_code} - {self.clicked_at}"
