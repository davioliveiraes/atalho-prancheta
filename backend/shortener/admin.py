"""
Configuração administrativa do Django para aplicativo de encurtamento de URLs.

Este módulo personaliza a interface administrativa do Django para gerenciar URLs encurtadas e cliques com recursos avançados como edição em linha filtro e ações personalizadas.
"""

from django.contrib import admin
from django.db.models import Count, Q
from django.db.models.query import QuerySet
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import Click, ShortenedURL


@admin.register(ShortenedURL)
class ShortenedURLAdmin(admin.ModelAdmin):
    """
    Interface administrativa avançada para o modelo ShortenedURL.

    Funcionalidades:
        - Exibição de lista com badges de status coloridos
        - Filtros por status, data de criação, expiração e limite de cliques
        - Busca por código curto e URL original
        - Preview de QR Code inline e ampliado
        - Estatísticas de cliques com barra de progresso
        - Histórico detalhada dos últimos 10 cliques
        - Ações em massa para ativar, desativar e deletar URLs expiradas
        - Fieldsets organizados para melhor experiência de edição
        - Campos somente leitura para dados do sistema
        - Ordenação por data de criação (mais recentes primeiro)
        - Hierarquia de datas para navegação temporal

    Campos Calculados:
        - original_url_truncated: URL original truncada com link
        - status_badge: Badge colorido com ícone de status
        - click_stats: Estatísticas com basse de progresso
        - qr_proview: Miniatura do QR Code (40x40)
        - qr_code_large: Preview ampliado do QR Code (300x300)
        - short_url_full: URL completa com botão de teste
        - access_status_display: Tabela detalhda de status de acesso
        - recent_clicks_display: Tabela dos últimos 10 cliques

    Ações Disponíveis:
        - activate_selected: Ativa URLs selecionadas
        - deactivate_selected: Desativa URLs selecionadas
        - delete_expired_urls: Remove URLs expiradas do banco
    """

    list_display = [
        "short_code",
        "original_url_truncated",
        "status_badge",
        "click_stats",
        "qr_preview",
        "expires_at",
        "created_at",
    ]

    list_filter = [
        "is_active",
        "created_at",
        "expires_at",
        "max_clicks",
    ]

    search_fields = ["short_code", "original_url"]

    readonly_fields = [
        "short_code",
        "total_clicks",
        "unique_clicks",
        "qr_code",
        "qr_code_large",
        "short_url_full",
        "access_status_display",
        "recent_clicks_display",
        "created_at",
        "updated_at",
    ]

    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    actions = ["activate_selected", "deactivate_selected", "delete_expired_urls"]

    fieldsets = (
        (
            "Informacoes Basicas",
            {"fields": ("original_url", "short_code", "short_url_full")},
        ),
        (
            "QR Code",
            {
                "fields": ("qr_code", "qr_code_large"),
                "classes": ("collapse",),
            },
        ),
        (
            "Configuracoes",
            {
                "fields": ("is_active", "expires_at", "max_clicks"),
                "description": "Configure as restricoes do link",
            },
        ),
        (
            "Estatisticas",
            {
                "fields": ("total_clicks", "unique_clicks", "access_status_display"),
                "description": "Contadores de cliques",
            },
        ),
        (
            "Histórico de Cliques",
            {
                "fields": ("recent_clicks_display",),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadados",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
                "description": "Informacoes de criacao e atualizacao",
            },
        ),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            clicks_count=Count("clicks"),
            unique_ips_count=Count("clicks__ip_address", distinct=True),
        )

    def original_url_truncated(self, obj):
        url = obj.original_url
        if len(url) > 50:
            display_text = url[:47] + "..."
        else:
            display_text = url
        return format_html(
            '<a href="{}" target="_blank" title="{}">{}</a>',
            url,
            url,
            display_text,
        )

    original_url_truncated.short_description = "URL Original"

    def status_badge(self, obj):
        can_access, message = obj.can_be_accessed()

        if can_access and obj.is_active:
            color = "#28a745"
            icon = "✓"
            text = "Ativo"
        elif not obj.is_active:
            color = "#6c757d"
            icon = "●"
            text = "Inativo"
        elif obj.is_expired():
            color = "#dc3545"
            icon = "⏱"
            text = "Expirado"
        elif obj.has_reached_max_clicks():
            color = "#fd7e14"
            icon = "!"
            text = "Limite"
        else:
            color = "#6c757d"
            icon = "?"
            text = "N/A"

        return format_html(
            '<span style="color: {}; font-weight: bold; font-size: 14px;">{} {}</span>',
            color,
            icon,
            text,
        )

    status_badge.short_description = "Status"
    status_badge.admin_order_field = "is_active"

    def click_stats(self, obj):
        total = obj.total_clicks
        unique = obj.unique_clicks

        max_clicks = obj.max_clicks if obj.max_clicks else 100
        percentage = min(int((total / max_clicks) * 100), 100) if max_clicks else 0

        return format_html(
            """
            <div style="width: 120px;">
                <div style="margin-bottom: 2px;">
                    <strong>{}</strong> total | <strong>{}</strong> únicos
                </div>
                <div style="width: 100%; background: #e9ecef; border-radius: 3px; height: 6px;">
                  <div style="width: {}%; background: #007bff; height: 6px; border-radius: 3px;"></div>
                </div>
            </div>
            """,
            total,
            unique,
            percentage,
        )

    click_stats.short_description = "Cliques"

    def qr_preview(self, obj):
        if obj.qr_code:
            return format_html(
                '<img src="{}" width="40" height="40" style="border: 1px solid #ddd;" />',
                obj.qr_code.url,
            )
        return format_html('<span style="color: #999;">Sem QR</span>')

    qr_preview.short_description = "QR"

    def qr_code_large(self, obj):
        if obj.qr_code:
            return format_html(
                """
                <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <img src="{}" width="300" height="300"
                         style="border: 2px solid #dee2e6; border-radius: 8px; padding: 10px; background: white;" />
                    <p style="margin-top: 10px; color: #6c757d;">
                        <a href="{}" target="_blank">Baixar QR Code</a>
                    </p>
                </div>
                """,
                obj.qr_code.url,
                obj.qr_code.url,
            )
        return format_html('<p style="color: #999;">QR Code não gerado</p>')

    qr_code_large.short_description = "Preview do QR Code"

    def short_url_full(self, obj):
        short_url = f"http://localhost:8000/api/r/{obj.short_code}"
        return format_html(
            """
            <div style="padding: 10px; background: #e7f3ff; border-left: 3px solid #007bff; border-radius: 4px;">
                <code style="font-size: 14px; color: #0056b3;">{}</code>
                <a href="{}" target="_blank" style="margin-left: 10px; text-decoration: none;">🔗 Testar</a>
            </div>
            """,
            short_url,
            short_url,
        )

    short_url_full.short_description = "URL Encurtada Completa"

    def access_status_display(self, obj):
        can_access, message = obj.can_be_accessed()

        status_color = "#28a745" if can_access else "#dc3545"
        status_text = "✓ Acessível" if can_access else "✗ Inacessível"

        return format_html(
            """
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: {}; color: white;">
                    <th colspan="2" style="padding: 8px; text-align: left;">{}</th>
                </tr>
                <tr>
                    <td style="padding: 6px; border: 1px solid #ddd;"><strong>Mensagem:</strong></td>
                    <td style="padding: 6px; border: 1px solid #ddd;">{}</td>
                </tr>
                <tr>
                    <td style="padding: 6px; border: 1px solid #ddd;"><strong>Ativo:</strong></td>
                    <td style="padding: 6px; border: 1px solid #ddd;">{}</td>
                </tr>
                <tr>
                    <td style="padding: 6px; border: 1px solid #ddd;"><strong>Expirado:</strong></td>
                    <td style="padding: 6px; border: 1px solid #ddd;">{}</td>
                </tr>
                <tr>
                    <td style="padding: 6px; border: 1px solid #ddd;"><strong>Limite Atingido:</strong></td>
                    <td style="padding: 6px; border: 1px solid #ddd;">{}</td>
                </tr>
            </table>
            """,
            status_color,
            status_text,
            message,
            "✓ Sim" if obj.is_active else "✗ Não",
            "✓ Sim" if obj.is_expired() else "✗ Não",
            "✓ Sim" if obj.has_reached_max_clicks() else "✗ Não",
        )

    access_status_display.short_description = "Status de Acesso Detalhado"

    def recent_clicks_display(self, obj):
        clicks = obj.clicks.all().order_by("-clicked_at")[:10]

        if not clicks.exists():
            return format_html(
                '<p style="color: #999; font-style: italic;">Nenhum clique registrado ainda</p>'
            )

        html = """
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background: #f8f9fa; text-align: left;">
                    <th style="padding: 8px; border: 1px solid #dee2e6;">Data/Hora</th>
                    <th style="padding: 8px; border: 1px solid #dee2e6;">IP</th>
                    <th style="padding: 8px; border: 1px solid #dee2e6;">User Agent</th>
                    <th style="padding: 8px; border: 1px solid #dee2e6;">Referer</th>
                </tr>
            </thead>
            <tbody>
        """

        for click in clicks:
            user_agent = (
                (click.user_agent[:50] + "..." if len(click.user_agent) > 50 else click.user_agent)
                if click.user_agent
                else "-"
            )
            referer = (
                (click.referer[:40] + "..." if len(click.referer) > 40 else click.referer)
                if click.referer
                else "-"
            )

            html += f"""
                <tr>
                    <td style="padding: 6px; border: 1px solid #dee2e6;">
                        {click.clicked_at.strftime("%d/%m/%Y %H:%M:%S")}
                    </td>
                    <td style="padding: 6px; border: 1px solid #dee2e6;">{click.ip_address}</td>
                    <td style="padding: 6px; border: 1px solid #dee2e6;" title="{click.user_agent}">
                        {user_agent}
                    </td>
                    <td style="padding: 6px; border: 1px solid #dee2e6;" title="{click.referer}">
                        {referer}
                    </td>
                </tr>
            """

        html += "</tbody></table>"

        total_clicks = obj.Clicks.count()
        if total_clicks > 10:
            html += f'<p style="margin-top: 10px; color: #6c757d; font-size: 11px;">Mostrando 10 de {total_clicks} cliques totais</p>'

        return mark_safe(html)

    recent_clicks_display.short_description = "Ultimos 10 Cliques"

    def activate_selected(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(
            request,
            f"{updated} URL(s) ativada(s) com sucesso.",
            level="success",
        )

    activate_selected.short_description = "✓ Ativar URLs selecionadas"

    def deactivate_selected(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(
            request,
            f"{updated} URL(s) desativada(s) com sucesso.",
            level="warning",
        )

    deactivate_selected.short_description = "● Desativar URLs selecionadas"

    def delete_expired_urls(self, request, queryset):
        expired = queryset.filter(expires_at__lt=timezone.now())
        count = expired.count()
        if count > 0:
            expired.delete()
            self.message_user(
                request,
                f"{count} URL(s) expirada(s) deletada(s).",
                level="success",
            )
        else:
            self.message_user(
                request,
                "Nenhuma URL expirada encontrada.",
                level="info",
            )

    delete_expired_urls.short_description = "🗑 Deletar URLs expiradas"


@admin.register(Click)
class ClickAdmin(admin.ModelAdmin):
    """
    Interface administrativa para o modelo Click

    Funcionalidades:
        - Exibição de lista com informações do clique
        - Filtros por data e URL
        - Busca por código curto da URL, IP e user agent
        - Campos somente leitura (cliques são imutáveis)
        - Hierarquia de datas para navegação temporal
        - Formatação especial do user agent e referer
        - Link direto para a URL associada no admin

    Restrições:
        - Não permite adicionar cliques manualmente
        - Não permite editar cliques existentes
        - Apenas visualização e deleção (se necessário)
    """

    list_display = [
        "url",
        "ip_address",
        "clicked_at_formatted",
        "referer_display",
    ]
    list_filter = ["clicked_at", "url"]
    search_fields = ["url__short_code", "ip_address", "user_agent"]
    readonly_fields = [
        "url",
        "url_link",
        "ip_address",
        "user_agent",
        "user_agent_formatted",
        "referer",
        "clicked_at",
    ]

    date_hierarchy = "clicked_at"
    ordering = ["-clicked_at"]

    fieldsets = (
        (
            "Informacoes de Clique",
            {
                "fields": ("url", "url_link", "clicked_at"),
            },
        ),
        (
            "Dados do Visitante",
            {
                "fields": ("ip_address", "user_agent", "user_agent_formatted", "referer"),
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def url_link(self, obj):
        url_admin = reverse("admin:shortener_shortenedurl_change", args=[obj.url.pk])
        return format_html(
            '<a href="{}" style="font-weight: bold; color: #007bff;">{}</a>',
            url_admin,
            obj.url.short_code,
        )

    url_link.short_description = "URL (Admin)"

    def clicked_at_formatted(self, obj):
        return obj.clicked_at.strftime("%d/%m/%Y %H:%M:%S")

    clicked_at_formatted.short_description = "Data/Hora do Clique"
    clicked_at_formatted.admin_order_field = "clicked_at"

    def referer_display(self, obj):
        if obj.referer:
            if len(obj.referer) > 40:
                display = obj.referer[:37] + "..."
            else:
                display = obj.referer
            return format_html(
                '<a href="{}" target="_blank" title="{}">{}</a>',
                obj.referer,
                obj.referer,
                display,
            )
        return format_html('<span style="color: #999;">-</span>')

    referer_display.short_description = "Origem (Referer)"

    def user_agent_formatted(self, obj):
        if not obj.user_agent:
            return format_html('<p style="color: #999;">Não disponível</p>')

        return format_html(
            """
            <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">{}</pre>
            </div>
            """,
            obj.user_agent,
        )

    user_agent_formatted.short_description = "User Agent Completo"
