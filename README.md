# 🔗 Atalho — links permanentes

> Aplicação full stack para publicar um endereço fixo e atualizar seu destino quando necessário.

[![Python](https://img.shields.io/badge/Python-3.14-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0.8-green.svg)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.14.0-red.svg)](https://www.django-rest-framework.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-159%20passing-brightgreen.svg)](https://github.com/davioliveiraes/url-shortener-api)

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
- [Demo Online](#demo-online)
- [Documentação](#documentação)
- [Contribuindo](#contribuindo)

---

## Sobre o Projeto

Aplicação full stack para criar atalhos permanentes. O código divulgado permanece igual enquanto o destino pode ser atualizado pela interface ou pela API REST.

### Destaques

- ✅ **159 testes automatizados** com 100% de sucesso
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
┌─────────────────┐
│ Django REST API │
│ ViewSets        │
│ Serializers     │
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

3. **Suba backend, frontend e banco de dados**
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
- Referência da API: http://localhost:5173/api
- API: http://localhost:8000/api/urls/
- Admin: http://localhost:8000/admin/

> A referência em `/api` lista as rotas e o acesso que cada uma exige. Os exemplos
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
  "short_url": "http://localhost:8000/api/r/abc123/",
  "qr_code": "http://localhost:8000/media/qrcodes/abc123.png",
  "is_active": true,
  "total_clicks": 0,
  "unique_clicks": 0,
  "created_at": "2024-12-01T10:00:00Z"
}
```

### Redirecionar
```bash
curl -L http://localhost:8000/api/r/abc123/
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

### Actions

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | `/api/urls/{code}/activate/` | Ativa URL | Somente o dono |
| POST | `/api/urls/{code}/deactivate/` | Desativa URL | Somente o dono |
| GET | `/api/urls/{code}/statistics/` | Estatísticas | Dono, ou qualquer um se o link não tem dono |
| GET | `/api/urls/{code}/qrcode/` | QR Code | Dono, ou qualquer um se o link não tem dono |

### Redirect

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/r/{code}/` | Redireciona para URL original |

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
Found 159 test(s).
System check identified no issues (0 silenced).
...............................................................................................................................................................
----------------------------------------------------------------------
Ran 159 tests in 25.632s

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

---

## Demo Online

> ⚠️ **Demonstração temporária** para fins de portfólio.

**API em Produção:** https://url-shortener-api-9h2j.onrender.com

### Teste Rápido:
```bash
# Listar URLs
curl https://url-shortener-api-9h2j.onrender.com/api/urls/

# Criar URL encurtada
curl -X POST https://url-shortener-api-9h2j.onrender.com/api/urls/ \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://github.com/davioliveiraes"}'

# Redirecionar (substitua {code})
https://url-shortener-api-9h2j.onrender.com/api/r/{code}/
```

### Django Admin:
- **URL:** https://url-shortener-api-9h2j.onrender.com/admin/
- **User:** admin (senha disponível sob solicitação)

### ⚠️ Nota sobre QR Codes:

Os QR Codes são gerados automaticamente, mas devido ao **storage efêmero do Render**, as imagens não persistem entre deploys.

**Para produção real:** AWS S3 ou Cloudinary
**Para visualizar QR Codes:** Rode localmente com Docker

### Características do Deploy:
- ✅ PostgreSQL 16 em produção
- ✅ Gunicorn + WhiteNoise
- ✅ SSL/HTTPS automático
- ✅ CI/CD via GitHub
- ✅ 68 testes (100% passing)

### Endpoints Principais:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/urls/` | Lista URLs |
| POST | `/api/urls/` | Cria URL |
| GET | `/api/urls/{code}/` | Detalhes |
| GET | `/api/urls/{code}/statistics/` | Estatísticas |
| GET | `/api/urls/{code}/qrcode/` | QR Code* |
| GET | `/api/r/{code}/` | Redireciona |

> *QR Codes funcionam via download. Para persistência, configure storage externo.

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
