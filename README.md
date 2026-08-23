# 🔗 Atalho Prancheta

> Um endereço curto que você conserta depois.

[![Django](https://img.shields.io/badge/Django-6.0.8-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-173%20passing-brightgreen.svg)](https://github.com/davioliveiraes/atalho-prancheta)

Encurtador de links com contagem de cliques. A diferença está no que acontece
depois: **o código divulgado nunca muda, e o destino por trás dele pode ser
trocado quando você quiser.** Dá para imprimir o QR Code antes de a página de
destino existir, ou corrigir um endereço errado depois que o material já foi
distribuído.

Encurtar não exige conta. Com conta, o link aparece num painel com os números de
cada um — e cada painel enxerga apenas os próprios links.

Python 3.14 · Django 6.0.8 · Django REST Framework 3.18.0 · PostgreSQL 15 ·
Redis 8 · React 19 · TypeScript · Vite 8 · Docker

---

## Funcionalidades

- **Destino atualizável** sem alterar o atalho divulgado
- **Endereço na raiz** — `seudominio.com/abc123`, com código gerado ou escolhido
- **Cliques totais e únicos** por IP, guardando navegador, origem e horário
- **Expiração por data** e **limite de visitantes**; fechado, o link avisa sem revelar o destino
- **QR Code** gerado no servidor, apontando para o link curto
- **Contas com JWT**, busca, filtros e resumo de cliques no painel

---

## Como rodar

Precisa de Docker e Docker Compose.

```bash
git clone https://github.com/davioliveiraes/atalho-prancheta.git
cd atalho-prancheta
cp .env.example .env
docker compose up -d
```

As migrações rodam na subida. Para o admin, crie um superusuário:

```bash
docker compose exec backend python manage.py createsuperuser
```

| | |
|---|---|
| Aplicação | http://localhost:5173 |
| Como usar | http://localhost:5173/como-usar |
| Referência da API | http://localhost:5173/referencia |
| Admin | http://localhost:8000/admin/ |

---

## API

JSON, com autenticação por JWT no cabeçalho `Authorization: Bearer <access>`.

| Método | Rota | O que faz | Acesso |
|--------|------|-----------|--------|
| GET | `/{codigo}` | redireciona e conta o clique | público |
| POST | `/api/urls/` | cria o link | aberto |
| GET | `/api/urls/` · `/summary/` | lista e soma os links da conta | token |
| GET · PATCH · DELETE | `/api/urls/{codigo}/` | detalhe, edição e remoção | dono |
| POST | `/api/urls/{codigo}/activate/` · `/deactivate/` | liga e desliga | dono |
| GET | `/api/urls/{codigo}/statistics/` · `/qrcode/` | números e QR Code | dono |
| POST | `/api/auth/register/` · `/login/` · `/refresh/` | conta e tokens | aberto |
| POST · GET | `/api/auth/logout/` · `/me/` | encerra e identifica a sessão | token |

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

Uma VPS com Docker: Postgres, Redis, gunicorn e um nginx com certificado do
Let's Encrypt renovado sozinho. O passo a passo — certificado, variáveis de
ambiente, atualização e backup — está em [`DEPLOY.md`](DEPLOY.md).

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Documentação

| Onde | O quê |
|---|---|
| `/referencia` | as rotas e o acesso que cada uma exige, dentro da aplicação |
| `/como-usar` | como usar, escrito para quem vai usar |
| [`docs/EXAMPLES.md`](docs/EXAMPLES.md) | exemplos de corpo completo, e a coleção do Postman ao lado |
| [`docs/roteiro-demonstracao.html`](docs/roteiro-demonstracao.html) | roteiro para demonstrar o projeto |

**[▶️ Vídeo da API no YouTube](https://www.youtube.com/watch?v=IOMnWbSL8Og)** —
gravado antes das contas e do endereço na raiz, então mostra uma API que mudou;
a referência atual é a `/referencia`.

---

**Davi Oliveira** ·
[GitHub](https://github.com/davioliveiraes) ·
[LinkedIn](https://linkedin.com/in/davioliveiraes) ·
[YouTube](https://www.youtube.com/@davioliveiraES) ·
[como contribuir](CONTRIBUTING.md)
