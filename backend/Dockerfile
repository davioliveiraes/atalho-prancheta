# syntax=docker/dockerfile:1

# Mantém a mesma versão definida em runtime.txt.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# psycopg[binary] e Pillow entregam wheels prontas: nada precisa ser compilado,
# então não instalamos build-essential/libpq-dev (imagem ~400MB menor).
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY backend/ .

# Diretórios gravados em runtime precisam existir antes de trocar de usuário.
RUN mkdir -p /app/staticfiles /app/media \
    && useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# O Compose sobrescreve este comando no desenvolvimento.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3}"]
