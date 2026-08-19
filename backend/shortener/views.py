"""
APIs de visualização para aplicativos de encurtamento de URLs.

Este módulo contém ViewSets e visualizações para gerenciar URLs encurtadas, lidar com redirecionamentos e rastrear cliques.
"""

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import F, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Click, ShortenedURL
from .serializers import (
    ClickSerializer,
    ShortenedURLCreateSerializer,
    ShortenedURLDetailSerializer,
    ShortenedURLListSerializer,
    ShortenedURLUpdateSerializer,
)
from .utils import generate_qr_code, get_client_ip


class ShortenedURLViewSet(viewsets.ModelViewSet):
    """
        Conjunto de visualizações para gerenciar URLs encurtadas.

        Fornece operações CRUD e ações personalizadas para gerenciamento de URLs.

    Endpoints:
        - GET /api/urls/ - Listar todos os URLs (com paginação, pesquisa e filtros)
        - POST /api/urls/ - Criar um novo URL encurtado
        - GET /api/urls/{short_code}/ - Recuperar detalhes do URL
        - PATCH /api/urls/{short_code}/ - Atualizar URL
        - DELETE /api/urls/{short_code}/ - Excluir URL
        - POST /api/urls/{short_code}/activate/ - Ativar URL
        - POST /api/urls/{short_code}/deactivate/ - Desativar URL
        - GET /api/urls/{short_code}/statistics/ - Obter estatísticas do URL
        - GET /api/urls/{short_code}/qrcode/ - Obter código QR
    """

    queryset = ShortenedURL.objects.all()
    lookup_field = "short_code"

    def get_serializer_class(self):
        if self.action == "list":
            return ShortenedURLListSerializer
        elif self.action in ["create"]:
            return ShortenedURLCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return ShortenedURLDetailSerializer
        return ShortenedURLDetailSerializer

    def get_queryset(self):
        queryset = ShortenedURL.objects.all()

        is_active = self.request.query_params.get("is_active")  # type: ignore
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        search = self.request.query_params.get("search")  # type: ignore
        if search:
            queryset = queryset.filter(
                Q(short_code__icontains=search) | Q(original_url__icontains=search)
            )

        return queryset.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        short_url = request.build_absolute_uri(f"/api/r/{instance.short_code}")
        qr_code_file = generate_qr_code(short_url, instance.short_code)
        instance.qr_code.save(f"{instance.short_code}.png", qr_code_file, save=True)

        detail_serializer = ShortenedURLDetailSerializer(instance, context={"request": request})
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        detail_serializer = ShortenedURLDetailSerializer(instance, context={"request": request})
        return Response(detail_serializer.data)

    @action(detail=True, methods=["post"])
    def activate(self, request, short_code=None):
        url = self.get_object()
        url.is_active = True
        url.save()

        serializer = ShortenedURLDetailSerializer(url, context={"request": request})
        return Response(
            {
                "message": "Link ativado com sucesso",
                "data": serializer.data,
            }
        )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, short_code=None):
        url = self.get_object()
        url.is_active = False
        url.save()

        serializer = ShortenedURLDetailSerializer(url, context={"request": request})
        return Response(
            {
                "message": "Link desativado com sucesso",
                "data": serializer.data,
            }
        )

    @action(detail=True, methods=["get"])
    def statistics(self, request, short_code=None):
        url = self.get_object()

        recent_clicks = url.clicks.all()[:20]

        from .serializers import ClickSerializer

        data = {
            "short_code": url.short_code,
            "original_url": url.original_url,
            "is_active": url.is_active,
            "total_clicks": url.total_clicks,
            "unique_clicks": url.unique_clicks,
            "is_expired": url.is_expired(),
            "has_reached_max_clicks": url.has_reached_max_clicks(),
            "expires_at": url.expires_at,
            "max_clicks": url.max_clicks,
            "created_at": url.created_at,
            "recent_clicks": ClickSerializer(recent_clicks, many=True).data,
        }

        return Response(data)

    @action(detail=True, methods=["get"])
    def qrcode(self, request, short_code=None):
        url = self.get_object()

        if url.qr_code:
            return Response(
                {
                    "short_code": url.short_code,
                    "qr_code_url": request.build_absolute_uri(url.qr_code.url),
                }
            )

        return Response(
            {"error": "QR Code nao disponivel para esta URL"}, status=status.HTTP_404_NOT_FOUND
        )


@csrf_exempt
def redirect_shortened_url(request, short_code):
    try:
        url = ShortenedURL.objects.get(short_code=short_code)
    except ObjectDoesNotExist:
        return JsonResponse(
            {"error": "URL encurtada nao encontrado", "short_code": short_code},
            status=404,
        )

    can_access, message = url.can_be_accessed()

    if not can_access:
        return JsonResponse(
            {"error": message, "short_code": short_code},
            status=403,
        )

    ip_address = get_client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "")
    referer = request.META.get("HTTP_REFERER", "")

    is_unique = not Click.objects.filter(url=url, ip_address=ip_address).exists()

    Click.objects.create(url=url, ip_address=ip_address, user_agent=user_agent, referer=referer)

    if is_unique:
        ShortenedURL.objects.filter(pk=url.pk).update(
            total_clicks=F("total_clicks") + 1, unique_clicks=F("unique_clicks") + 1
        )
    else:
        ShortenedURL.objects.filter(pk=url.pk).update(total_clicks=F("total_clicks") + 1)

    return redirect(url.original_url)
