# 🔗 Atalho — links permanentes

> Aplicação full stack para publicar um endereço fixo e atualizar seu destino quando necessário.

[![Python](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0.8-green.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.14.0-red.svg)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-173%20passing-brightgreen.svg)](https://github.com/davioliveiraes/url-shortener-api)

---

## Vídeo de uso da API!

**[▶️ Assistir demonstração completa no YouTube (10 minutos)](https://www.youtube.com/watch?v=IOMnWbSL8Og)**

*O vídeo demonstra: criação de URLs, tracking de cliques, QR Codes, estatísticas, validações, interface admin e testes automatizados.*

---

## Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Testes](#testes)
- [Deploy](#deploy)
- [Documentação](#documentação)
- [Contribuindo](#contribuindo)

---

## Sobre o Projeto

Aplicação full stack para criar atalhos permanentes. O código divulgado permanece igual enquanto o destino pode ser atualizado pela interface ou pela API REST.

### Destaques

- ✅ **173 testes automatizados** com 100% de sucesso
- ✅ **Cobertura completa** de models, serializers e views
- ✅ **Código limpo** seguindo PEP 8 e boas práticas
- ✅ **Dockerizado** para fácil deployment
- ✅ **Frontend React responsivo** com design system próprio
- ✅ **Documentação completa** com Postman
- ✅ **Interface Admin** customizada

---

## Funcionalidades

### Core Features

- 🧭 **Destino atualizável** sem alterar o atalho divulgado
- 🔗 **Encurtamento de URLs** com código auto-gerado ou customizado
- 📊 **Tracking de Cliques** (total e únicos por IP)
- ⏰ **URLs com Expiração** (data/hora customizável)
- 🔢 **Limite de Cliques** (máximo de acessos configurável)
- 🎨 **QR Code Automático** gerado para cada URL
- 🔍 **Busca e Filtros** avançados
- 📈 **Estatísticas Detalhadas** por URL
- ✅ **Ativar/Desativar URLs** dinamicamente
- 👤 **Contas com JWT** — cada painel lista apenas os links da própria conta

### Segurança e Validações

- ✅ Validação de formato de URL
- ✅ Código curto alfanumérico (mínimo 3 caracteres)
- ✅ Unicidade de códigos curtos
- ✅ Validação de datas de expiração
- ✅ Proteção contra valores inválidos

---

## Tecnologias

### Backend
- **Python 3.14** - Linguagem principal
- **Django 6.0.8** - Framework web
- **Django REST Framework 3.14.0** - API REST
- **PostgreSQL 15** - Banco de dados
- **psycopg3** - Driver PostgreSQL
- **Redis 8** - Cache do teto de criação, compartilhado entre os workers

### Frontend
- **React 19** - Interface declarativa
- **TypeScript** - Tipagem estática
- **Vite 8** - Desenvolvimento e build
- **CSS Variables** - Tokens do design system

### DevOps & Tools
- **Docker & Docker Compose** - Containerização
- **Git** - Controle de versão

### Qualidade de Código
- **pylint** - Linter
- **black** - Formatação automática
- **isort** - Organização de imports
- **pre-commit** - Git hooks

### Bibliotecas Adicionais
- **qrcode** - Geração de QR Codes
- **Pillow** - Processamento de imagens

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
│ ViewSets        │        │ teto de criação  │
│ Serializers     │        └──────────────────┘
│ Models          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PostgreSQL 15   │
└─────────────────┘
```

### Padrões de Projeto

- **MVT** (Model-View-Template) - Arquitetura Django
- **Serializer Pattern** - Validação e transformação de dados
- **ViewSet Pattern** - Organização de endpoints REST

---

## Instalação

### Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+
- Git

### Passo a Passo

1. **Clone o repositório**
```bash
git clone https://github.com/davioliveiraes/atalho-prancheta.git
cd atalho-prancheta
```

2. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

3. **Suba backend, frontend, banco de dados e cache**
```bash
docker compose up -d
```

4. **Execute as migrações**
```bash
docker compose exec backend python manage.py migrate
```

5. **Crie um superusuário**
```bash
docker compose exec backend python manage.py createsuperuser
```

6. **Links criados antes das contas** (opcional)

O painel lista por dono, então links antigos ficam sem aparecer. Para transferi-los:
```bash
docker compose exec backend python manage.py adotar_links voce@exemplo.com --simular
docker compose exec backend python manage.py adotar_links voce@exemplo.com
```

7. **Acesse a aplicação**
- Frontend: http://localhost:5173/
- Criar conta: http://localhost:5173/criar-conta — o painel (`/painel`) exige conta;
  encurtar na home continua aberto
- Como usar: http://localhost:5173/como-usar
- Referência da API: http://localhost:5173/referencia
- API: http://localhost:8000/api/urls/
- Admin: http://localhost:8000/admin/

> A referência em `/referencia` lista as rotas e o acesso que cada uma exige. Os exemplos
> de corpo completo estão em [`docs/EXAMPLES.md`](docs/EXAMPLES.md), com a coleção
> Postman em [`docs/`](docs/).

---

## Uso

### Criar URL Encurtada
```bash
curl -X POST http://localhost:8000/api/urls/ \
  -H "Content-Type: application/json" \
  -d '{
    "original_url": "https://github.com/yourusername"
  }'
```

**Response:**
```json
{
  "id": 1,
  "short_code": "abc123",
  "original_url": "https://github.com/yourusername",
  "short_url": "http://localhost:8000/abc123",
  "qr_code": "http://localhost:8000/media/qrcodes/abc123.png",
  "is_active": true,
  "total_clicks": 0,
  "unique_clicks": 0,
  "created_at": "2024-12-01T10:00:00Z"
}
```

### Redirecionar
```bash
curl -L http://localhost:8000/abc123
# Redireciona para https://github.com/yourusername
```

### Obter Estatísticas
```bash
curl http://localhost:8000/api/urls/abc123/statistics/
```

**Response:**
```json
{
  "short_code": "abc123",
  "total_clicks": 42,
  "unique_clicks": 28,
  "is_expired": false,
  "has_reached_max_clicks": false,
  "recent_clicks": [
    {
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "clicked_at": "2024-12-01T15:30:00Z"
    }
  ]
}
```

---

## API Endpoints

### Contas

Autenticação por JWT (`Authorization: Bearer <access>`). O encurtador continua
aberto: criar e consultar link não exige conta.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register/` | Cria conta e devolve o par de tokens |
| POST | `/api/auth/login/` | Troca e-mail e senha pelo par de tokens |
| POST | `/api/auth/refresh/` | Renova o access (o refresh também é rotacionado) |
| POST | `/api/auth/logout/` | Invalida o refresh enviado |
| GET | `/api/auth/me/` | Conta dona do token |

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email": "voce@exemplo.com", "password": "sua-senha-forte", "password_confirm": "sua-senha-forte"}'
```

### URLs

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/api/urls/` | Lista os links da conta | Exige token |
| GET | `/api/urls/summary/` | Somas da conta: links, cliques, únicos e fora do ar | Exige token |
| POST | `/api/urls/` | Cria nova URL | Aberto (com token, o link nasce com dono) |
| GET | `/api/urls/{code}/` | Detalhes da URL | Dono, ou qualquer um se o link não tem dono |
| PATCH | `/api/urls/{code}/` | Atualiza URL | Somente o dono |
| DELETE | `/api/urls/{code}/` | Deleta URL | Somente o dono |

> Criar link tem teto: por IP para quem não tem conta e por conta para quem tem
> (`THROTTLE_LINK_ANON` e `THROTTLE_LINK_USER` no `.env`). Passou do teto, a API
> responde 429. Ler, editar e redirecionar não têm limite.
>
> A contagem fica no Redis, então vale para a aplicação inteira e não por
> processo — com vários workers de gunicorn, um cache em memória daria a cada um
> a sua própria conta. Sem `REDIS_URL` a aplicação sobe do mesmo jeito, com o
> cache do processo.

### Actions

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | `/api/urls/{code}/activate/` | Ativa URL | Somente o dono |
| POST | `/api/urls/{code}/deactivate/` | Desativa URL | Somente o dono |
| GET | `/api/urls/{code}/statistics/` | Estatísticas | Dono, ou qualquer um se o link não tem dono |
| GET | `/api/urls/{code}/qrcode/` | QR Code | Dono, ou qualquer um se o link não tem dono |

### Saúde

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/api/health/` | 200 com o banco no ar, 503 sem ele | Público |

### Redirect

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/{code}` | Redireciona para URL original e conta o clique |
| GET | `/api/r/{code}/` | Mesmo destino, endereço antigo — mantido pelos links já divulgados |

### Filtros e Busca
```bash
# Buscar por palavra-chave
GET /api/urls/?search=github

# Filtrar por status
GET /api/urls/?is_active=true

# Paginação
GET /api/urls/?page=2
```

---

## Testes

### Executar Todos os Testes
```bash
docker compose run --rm backend python manage.py test
```

**Resultado:**
```
Found 173 test(s).
System check identified no issues (0 silenced).
.............................................................................................................................................................................
----------------------------------------------------------------------
Ran 173 tests in 27.505s

OK
```

### Categorias de Testes

- ✅ **Models** (17 testes) - Lógica de negócio
- ✅ **Serializers** (16 testes) - Validações de criação e de edição
- ✅ **Views** (45 testes) - Endpoints CRUD, ações, resumo, redirect e o que o PATCH não muda
- ✅ **Utils** (15 testes) - QR Code e IP do visitante
- ✅ **Admin** (13 testes) - Colunas e painéis calculados
- ✅ **Contas** (23 testes) - Cadastro, login, refresh, logout e `me`
- ✅ **Posse dos links** (18 testes) - Isolamento entre contas e link sem dono
- ✅ **Comandos** (7 testes) - `adotar_links`
- ✅ **Teto de criação** (5 testes) - Limite por IP e por conta
- ✅ **Saúde** (2 testes) - `/api/health/`, o que o orquestrador consulta
- ✅ **Rota curta** (12 testes) - `/{codigo}` na raiz e os nomes reservados

---

## Deploy

A aplicação roda numa VPS com Docker: Postgres, Redis, o backend em gunicorn e
um nginx que serve a interface e faz o proxy da API, com certificado do Let's
Encrypt renovado sozinho.

```bash
docker compose -f docker-compose.prod.yml up -d
```

O passo a passo completo — certificado, variáveis de ambiente e atualização —
está em [`DEPLOY.md`](DEPLOY.md). O backup do banco e dos QR Codes é o
[`deploy/backup.sh`](deploy/backup.sh), uma linha de cron por dia, com retenção
e envio opcional para fora da máquina.

### O que muda em relação ao desenvolvimento

| | Desenvolvimento | VPS |
|---|---|---|
| Arquivo | `docker-compose.yml` | `docker-compose.prod.yml` |
| Backend | `runserver`, código montado do host | gunicorn, código na imagem |
| Interface | Vite com HMR na 5173 | build estático servido pelo nginx |
| Banco | porta 5433 publicada | rede interna, sem porta |
| `/media/` | servido pelo Django | servido pelo nginx a partir do volume |
| TLS | não | nginx + certbot |

> Com `DEBUG=False` o Django não publica `MEDIA_URL` — o `static()` do
> `config/urls.py` devolve lista vazia fora do modo de depuração. Por isso os QR
> Codes são servidos pelo nginx direto do volume, e não pelo gunicorn.

---

## Documentação

### Postman Collection

Importe a coleção completa do Postman:

1. Abra o Postman
2. Import → `docs/postman_collection.json`
3. Import environment → `docs/postman_environment.json`
4. Configure a variável `base_url` para `http://localhost:8000`

### Exemplos de Uso

Veja exemplos detalhados em [`docs/EXAMPLES.md`](docs/EXAMPLES.md)

### Para demonstrar

[`docs/roteiro-demonstracao.html`](docs/roteiro-demonstracao.html) — oito passos,
com o que dizer em cada tela. Para quem vai *usar*, a explicação está na própria
aplicação, em `/como-usar`.

---

## Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---


## Autor

**Davi Oliveira**

- GitHub: [@davioliveira](https://github.com/davioliveiraes)
- LinkedIn: [Davi Oliveira](https://linkedin.com/in/davioliveiraes)
- YouTube: [Davi Oliveira](https://www.youtube.com/@davioliveiraES)

---

## Mostre seu Apoio

Se este projeto foi útil, considere dar uma ⭐!

---
