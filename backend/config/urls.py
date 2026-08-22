from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from shortener.views import redirect_shortened_url

from .health import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("shortener.urls")),
    # O link curto: `/{codigo}`. Por ultimo, e com o formato de um codigo no
    # proprio padrao, para nao engolir caminho de mais ninguem. Aceita com e sem
    # a barra final — um encurtador nao pode gastar um 301 em cada acesso.
    re_path(
        r"^(?P<short_code>[A-Za-z0-9]{3,10})/?$",
        redirect_shortened_url,
        name="redirect-curto",
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
