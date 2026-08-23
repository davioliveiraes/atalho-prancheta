# 🔗 Atalho Prancheta

> Um endereço curto que você conserta depois.

[![Python](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0.8-green.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.18.0-red.svg)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-173%20passing-brightgreen.svg)](https://github.com/davioliveiraes/atalho-prancheta)

Encurtador de links com contagem de cliques. A diferença está no que acontece
depois: **o código divulgado nunca muda, e o destino por trás dele pode ser
trocado quando você quiser.** Dá para imprimir o QR Code antes de a página de
destino existir, ou corrigir um endereço errado depois que o material já foi
distribuído.

Encurtar não exige conta. Com conta, o link passa a aparecer num painel com os
números de cada um — e cada painel enxerga apenas os próprios links.

---

## Funcionalidades

- 🧭 **Destino atualizável** sem alterar o atalho divulgado
- 🔗 **Endereço na raiz** — `seudominio.com/abc123`, com código gerado ou escolhido
- 📊 **Cliques totais e únicos** por IP, guardando navegador, origem e horário de cada acesso
- ⏰ **Expiração por data** e **limite de visitantes únicos**
- 🚦 **Ativar e desativar** — fechado, o link avisa sem revelar o destino
- 🎨 **QR Code** gerado no servidor na criação, apontando para o link curto
- 👤 **Contas com JWT** — o painel lista apenas os links da própria conta
- 🔍 **Busca, filtros e resumo** de cliques no painel

---

## Como rodar

Precisa de Docker e Docker Compose.

```bash
git clone https://github.com/davioliveiraes/atalho-prancheta.git
cd atalho-prancheta
cp .env.example .env
docker compose up -d
```

As migrações rodam na subida. Para entrar no admin, crie um superusuário:

```bash
docker compose exec backend python manage.py createsuperuser
```

### Endereços

| | |
|---|---|
| Aplicação | http://localhost:5173 |
| Como usar | http://localhost:5173/como-usar |
| Referência da API | http://localhost:5173/referencia |
| API | http://localhost:8000/api/urls/ |
| Admin | http://localhost:8000/admin/ |

> Links criados antes de existirem contas ficam sem dono e não aparecem em
> painel nenhum. Para transferi-los:
> `docker compose exec backend python manage.py adotar_links voce@exemplo.com`

---

## Arquitetura

```
┌─────────────────┐
│ React + Vite    │
│ Design System   │
└────────┬────────┘
         │ /api
         ▼
┌─────────────────┐        ┌──────────────────┐
│ Django REST API │───────▶│ Redis            │
│ gunicorn        │        │ teto de criação  │
└────────┬────────┘        └──────────────────┘
         │
         ▼
┌─────────────────┐
│ PostgreSQL 15   │
└─────────────────┘
```

Python 3.14 · Django 6.0.8 · Django REST Framework 3.18.0 · simplejwt ·
PostgreSQL 15 · Redis 8 · React 19 · TypeScript · Vite 8 · Docker

---

## API

JSON, com autenticação por JWT no cabeçalho `Authorization: Bearer <access>`.

| Método | Rota | O que faz | Acesso |
|--------|------|-----------|--------|
| GET | `/{codigo}` | redireciona e conta o clique | público |
| POST | `/api/urls/` | cria o link | aberto |
| GET | `/api/urls/` | lista os links da conta | token |
| GET | `/api/urls/summary/` | somas de links e cliques da conta | token |
| GET · PATCH · DELETE | `/api/urls/{codigo}/` | detalhe, edição e remoção | dono |
| POST | `/api/urls/{codigo}/activate/` · `/deactivate/` | liga e desliga | dono |
| GET | `/api/urls/{codigo}/statistics/` · `/qrcode/` | números e QR Code | dono |
| POST | `/api/auth/register/` · `/login/` · `/refresh/` | conta e tokens | aberto |
| POST · GET | `/api/auth/logout/` · `/api/auth/me/` | encerra e identifica a sessão | token |
| GET | `/api/health/` | 200 com o banco no ar, 503 sem ele | público |

```bash
curl -X POST http://localhost:8000/api/urls/ \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://github.com/davioliveiraes"}'
```

Criar link tem teto — 20 por hora sem conta e 120 com conta, ajustáveis no
`.env`. Ler, editar e redirecionar não têm limite.

---

## Testes

```bash
docker compose run --rm backend python manage.py test
```

173 testes cobrindo models, serializers, views, permissões, contas, o teto de
criação, os comandos e a rota curta.

---

## Deploy

A pilha de produção é o [`docker-compose.prod.yml`](docker-compose.prod.yml):
Postgres, Redis, gunicorn e um nginx com certificado do Let's Encrypt renovado
sozinho.

```bash
docker compose -f docker-compose.prod.yml up -d
```

O passo a passo — certificado, variáveis de ambiente, atualização e backup —
está em [`DEPLOY.md`](DEPLOY.md).

---

## Documentação

| Onde | O quê |
|---|---|
| `/referencia` | as rotas e o acesso que cada uma exige, dentro da aplicação |
| `/como-usar` | como usar, escrito para quem vai usar |
| [`docs/EXAMPLES.md`](docs/EXAMPLES.md) | exemplos de corpo completo de cada rota |
| [`docs/`](docs/) | coleção do Postman |
| [`docs/roteiro-demonstracao.html`](docs/roteiro-demonstracao.html) | roteiro para demonstrar o projeto |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | como contribuir |

**[▶️ Vídeo da API no YouTube](https://www.youtube.com/watch?v=IOMnWbSL8Og)** —
gravado antes das contas e do endereço na raiz, então a API mostrada ali mudou;
a referência atual é a `/referencia`.

---

## Autor

**Davi Oliveira**
[GitHub](https://github.com/davioliveiraes) ·
[LinkedIn](https://linkedin.com/in/davioliveiraes) ·
[YouTube](https://www.youtube.com/@davioliveiraES)
