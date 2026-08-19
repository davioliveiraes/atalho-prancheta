from django.urls import include, path

from rest_framework.routers import DefaultRouter

from .views import ShortenedURLViewSet, redirect_shortened_url

router = DefaultRouter()
router.register(r"urls", ShortenedURLViewSet, basename="shortened-url")

urlpatterns = [
    path("", include(router.urls)),
    path("r/<str:short_code>/", redirect_shortened_url, name="redirect"),
]
