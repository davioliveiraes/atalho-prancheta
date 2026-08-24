from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from shortener.slugs import shortlink_path_regex
from shortener.views import redirect_shortened_url

from .health import health
from .public_settings import public_settings

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/config/", public_settings, name="public-settings"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("shortener.urls")),
    # O link curto: `/{apelido}`. Por ultimo, e com o formato de um apelido no
    # proprio padrao, para nao engolir caminho de mais ninguem. Aceita com e sem
    # a barra final — um encurtador nao pode gastar um 301 em cada acesso.
    re_path(
        rf"^(?P<short_code>{shortlink_path_regex()})/?$",
        redirect_shortened_url,
        name="redirect-curto",
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
