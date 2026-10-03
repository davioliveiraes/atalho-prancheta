# 📖 Exemplos de Uso da API

> Exemplos práticos de uso da API simulando requisições no Postman.

---

## 📋 Índice

- [Contas e Autenticação](#contas-e-autenticação)
- [Criar URLs](#criar-urls)
- [Gerenciar URLs](#gerenciar-urls)
- [Estatísticas](#estatísticas)
- [Redirecionamento](#redirecionamento)

---

## 🔐 Contas e Autenticação

A API usa JWT. O token de acesso vai no cabeçalho `Authorization: Bearer <access>`.

Sem token ainda dá para **encurtar** e **consultar** um link (é o encurtador da
home). O que exige conta é a **lista** do painel, e alterar ou apagar um link só
o dono faz. Link criado sem conta não tem dono: qualquer um lê, ninguém altera.

### 1. Criar conta

**Request:**
```http
POST {{api_url}}/auth/register/
Content-Type: application/json
```

**Body:**
```json
{
    "name": "Davi",
    "email": "voce@exemplo.com",
    "password": "sua-senha-forte",
    "password_confirm": "sua-senha-forte"
}
```

**Response (201 Created):**
```json
{
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
        "id": 1,
        "name": "Davi",
        "email": "voce@exemplo.com",
        "date_joined": "2026-08-21T15:17:37.192010-03:00"
    }
}
```

A senha passa pelos validadores do Django. Senha curta, comum ou só de números
volta 400 com a lista de motivos em `password`.

### 2. Entrar

**Request:**
```http
POST {{api_url}}/auth/login/
Content-Type: application/json
```

**Body:**
```json
{
    "email": "voce@exemplo.com",
    "password": "sua-senha-forte"
}
```

Devolve o mesmo corpo do cadastro. E-mail inexistente e senha errada respondem
400 com a mesma mensagem — de propósito, para não revelar quem tem conta.

### 3. Usar o token

```http
GET {{api_url}}/urls/
Authorization: Bearer {{access_token}}
```

Sem o cabeçalho, a lista responde 401. O access dura 30 minutos.

### 4. Renovar o access

**Request:**
```http
POST {{api_url}}/auth/refresh/
Content-Type: application/json
```

**Body:**
```json
{
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Response (200 OK):** um `access` novo e também um `refresh` novo — o anterior
vai para a blacklist e não serve mais.

### 5. Sair

```http
POST {{api_url}}/auth/logout/
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

**Response:** 204 No Content. O refresh é invalidado; o access continua valendo
até expirar, o que é inerente a um token assinado.

### 6. Conta do token

```http
GET {{api_url}}/auth/me/
Authorization: Bearer {{access_token}}
```

### 7. Esqueceu a senha

```http
POST {{api_url}}/auth/password-reset/
Content-Type: application/json

{
    "email": "voce@exemplo.com"
}
```

**Response (200 OK):**
```json
{
    "detail": "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Ele vale por 60 minutos."
}
```

A resposta é a mesma exista ou não a conta. O link chega por e-mail no formato
`https://seudominio/redefinir-senha#uid=OQ&token=dful56-ee36...`, e um mesmo
endereço recebe no máximo um link a cada dois minutos.

### 8. Trocar a senha pelo link

```http
POST {{api_url}}/auth/password-reset/confirm/
Content-Type: application/json

{
    "uid": "OQ",
    "token": "dful56-ee369d6249631bc9d923609c1353c6bf",
    "password": "senha-nova-forte",
    "password_confirm": "senha-nova-forte"
}
```

**Response:** 204 No Content. A senha nova passa pelos mesmos validadores do
cadastro, e todos os refresh da conta vão para a blacklist — quem estava dentro
sai quando o access vencer.

Link vencido, já usado ou adulterado responde 400 com `detail`. O link deixa de
valer também quando a pessoa entra com a senha antiga depois de pedi-lo.

---

## 🔗 Criar URLs

### 1. Código Auto-Gerado

**Request:**
```http
POST {{api_url}}/urls/
Content-Type: application/json
```

**Body:**
```json
{
    "original_url": "https://github.com/davioliveira"
}
```

**Response (201 Created):**
```json
{
    "id": 1,
    "short_code": "k9mP2x",
    "original_url": "https://github.com/davioliveira",
    "short_url": "http://localhost:8000/k9mP2x",
    "qr_code": "http://localhost:8000/media/qrcodes/k9mP2x.png",
    "is_active": true,
    "total_clicks": 0,
    "unique_clicks": 0,
    "statistics": {
        "total_clicks": 0,
        "unique_clicks": 0,
        "is_expired": false,
        "has_reached_max_clicks": false
    },
    "created_at": "2024-12-01T10:15:00.123456Z"
}
```

---

### 2. Código Customizado

**Request:**
```http
POST {{api_url}}/urls/
Content-Type: application/json
```

**Body:**
```json
{
    "original_url": "https://linkedin.com/in/davi-oliveira",
    "short_code": "linkedin"
}
```

**Response (201 Created):**
```json
{
    "id": 2,
    "short_code": "linkedin",
    "original_url": "https://linkedin.com/in/davi-oliveira",
    "short_url": "http://localhost:8000/linkedin",
    "qr_code": "http://localhost:8000/media/qrcodes/linkedin.png",
    "is_active": true,
    "total_clicks": 0,
    "unique_clicks": 0,
    "created_at": "2024-12-01T10:16:30.789012Z"
}
```

---

### 3. Com Expiração e Limite de Cliques

**Request:**
```http
POST {{api_url}}/urls/
Content-Type: application/json
```

**Body:**
```json
{
    "original_url": "https://example.com/promo-black-friday",
    "short_code": "promo2025",
    "expires_at": "2025-12-31T23:59:59Z",
    "max_clicks": 100
}
```

**Response (201 Created):**
```json
{
    "id": 3,
    "short_code": "promo2025",
    "original_url": "https://example.com/promo-black-friday",
    "short_url": "http://localhost:8000/promo2025",
    "qr_code": "http://localhost:8000/media/qrcodes/promo2025.png",
    "is_active": true,
    "expires_at": "2025-12-31T23:59:59Z",
    "max_clicks": 100,
    "total_clicks": 0,
    "unique_clicks": 0,
    "statistics": {
        "total_clicks": 0,
        "unique_clicks": 0,
        "is_expired": false,
        "has_reached_max_clicks": false
    },
    "created_at": "2024-12-01T10:18:45.234567Z"
}
```

---

## ⚙️ Gerenciar URLs

### 1. Listar Todas

**Request:**
```http
GET {{api_url}}/urls/
```

**Response (200 OK):**
```json
{
    "count": 3,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 3,
            "short_code": "promo2025",
            "original_url": "https://example.com/promo-black-friday",
            "short_url": "http://localhost:8000/promo2025",
            "is_active": true,
            "total_clicks": 0,
            "unique_clicks": 0,
            "status": {
                "can_access": true,
                "message": "OK"
            },
            "created_at": "2024-12-01T10:18:45.234567Z"
        },
        {
            "id": 2,
            "short_code": "linkedin",
            "original_url": "https://linkedin.com/in/davi-oliveira",
            "short_url": "http://localhost:8000/linkedin",
            "is_active": true,
            "total_clicks": 0,
            "unique_clicks": 0,
            "status": {
                "can_access": true,
                "message": "OK"
            },
            "created_at": "2024-12-01T10:16:30.789012Z"
        }
    ]
}
```

---

### 2. Buscar por Palavra-Chave

**Request:**
```http
GET {{api_url}}/urls/?search=linkedin
```

**Response (200 OK):**
```json
{
    "count": 1,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 2,
            "short_code": "linkedin",
            "original_url": "https://linkedin.com/in/davi-oliveira",
            "short_url": "http://localhost:8000/linkedin",
            "is_active": true,
            "total_clicks": 0,
            "unique_clicks": 0,
            "created_at": "2024-12-01T10:16:30.789012Z"
        }
    ]
}
```

---

### 3. Filtrar URLs Ativas

**Request:**
```http
GET {{api_url}}/urls/?is_active=true
```

**Response (200 OK):**
```json
{
    "count": 3,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 3,
            "short_code": "promo2025",
            "original_url": "https://example.com/promo-black-friday",
            "is_active": true,
            "total_clicks": 0,
            "unique_clicks": 0
        },
        {
            "id": 2,
            "short_code": "linkedin",
            "original_url": "https://linkedin.com/in/davi-oliveira",
            "is_active": true,
            "total_clicks": 0,
            "unique_clicks": 0
        }
    ]
}
```

---

### 4. Ver Detalhes

**Request:**
```http
GET {{api_url}}/urls/linkedin/
```

**Response (200 OK):**
```json
{
    "id": 2,
    "original_url": "https://linkedin.com/in/davi-oliveira",
    "short_code": "linkedin",
    "short_url": "http://localhost:8000/linkedin",
    "is_active": true,
    "expires_at": null,
    "max_clicks": 0,
    "total_clicks": 0,
    "unique_clicks": 0,
    "qr_code": "http://localhost:8000/media/qrcodes/linkedin.png",
    "statistics": {
        "total_clicks": 0,
        "unique_clicks": 0,
        "is_expired": false,
        "has_reached_max_clicks": false
    },
    "status": {
        "can_access": true,
        "message": "OK"
    },
    "recent_clicks": [],
    "created_at": "2024-12-01T10:16:30.789012Z",
    "updated_at": "2024-12-01T10:16:30.789012Z"
}
```

---

### 5. Atualizar URL

**Request:**
```http
PATCH {{api_url}}/urls/linkedin/
Content-Type: application/json
```

**Body:**
```json
{
    "max_clicks": 50,
    "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response (200 OK):**
```json
{
    "id": 2,
    "original_url": "https://linkedin.com/in/davi-oliveira",
    "short_code": "linkedin",
    "short_url": "http://localhost:8000/linkedin",
    "is_active": true,
    "expires_at": "2025-12-31T23:59:59Z",
    "max_clicks": 50,
    "total_clicks": 0,
    "unique_clicks": 0,
    "updated_at": "2024-12-01T10:30:00.234567Z"
}
```

---

### 6. Desativar URL

**Request:**
```http
POST {{api_url}}/urls/linkedin/deactivate/
```

**Response (200 OK):**
```json
{
    "message": "Link desativado com sucesso",
    "data": {
        "id": 2,
        "short_code": "linkedin",
        "original_url": "https://linkedin.com/in/davi-oliveira",
        "is_active": false,
        "status": {
            "can_access": false,
            "message": "Link inativo"
        },
        "updated_at": "2024-12-01T10:32:15.890123Z"
    }
}
```

---

### 7. Ativar URL

**Request:**
```http
POST {{api_url}}/urls/linkedin/activate/
```

**Response (200 OK):**
```json
{
    "message": "Link ativado com sucesso",
    "data": {
        "id": 2,
        "short_code": "linkedin",
        "original_url": "https://linkedin.com/in/davi-oliveira",
        "is_active": true,
        "status": {
            "can_access": true,
            "message": "OK"
        },
        "updated_at": "2024-12-01T10:35:00.456789Z"
    }
}
```

---

### 8. Deletar URL

**Request:**
```http
DELETE {{api_url}}/urls/promo2025/
```

**Response (204 No Content):**
```
(sem conteúdo - sucesso)
```

---

### 9. Obter QR Code

**Request:**
```http
GET {{api_url}}/urls/linkedin/qrcode/
```

**Response (200 OK):**
```json
{
    "short_code": "linkedin",
    "qr_code_url": "http://localhost:8000/media/qrcodes/linkedin.png"
}
```

---

## 📊 Estatísticas

### 1. Ver Estatísticas Detalhadas

**Request:**
```http
GET {{api_url}}/urls/linkedin/statistics/
```

**Response (200 OK):**
```json
{
    "short_code": "linkedin",
    "original_url": "https://linkedin.com/in/davi-oliveira",
    "is_active": true,
    "total_clicks": 42,
    "unique_clicks": 28,
    "is_expired": false,
    "has_reached_max_clicks": false,
    "expires_at": "2025-12-31T23:59:59Z",
    "max_clicks": 50,
    "created_at": "2024-12-01T10:16:30.789012Z",
    "recent_clicks": [
        {
            "id": 28,
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "referer": "https://google.com",
            "clicked_at": "2024-12-01T15:30:00.123456Z"
        },
        {
            "id": 27,
            "ip_address": "192.168.1.50",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
            "referer": "https://twitter.com",
            "clicked_at": "2024-12-01T14:22:15.789012Z"
        },
        {
            "id": 26,
            "ip_address": "10.0.0.5",
            "user_agent": "PostmanRuntime/7.36.0",
            "referer": "",
            "clicked_at": "2024-12-01T13:15:45.456789Z"
        }
    ]
}
```

---

### 2. Análise de Clicks

**Exemplo de estatísticas com diferentes cenários:**

#### URL com Alta Atividade
```json
{
    "short_code": "github",
    "total_clicks": 1523,
    "unique_clicks": 847,
    "is_expired": false,
    "has_reached_max_clicks": false
}
```

#### URL Próxima do Limite
```json
{
    "short_code": "promo2025",
    "total_clicks": 98,
    "unique_clicks": 98,
    "max_clicks": 100,
    "is_expired": false,
    "has_reached_max_clicks": false
}
```

#### URL Expirada
```json
{
    "short_code": "old-promo",
    "total_clicks": 45,
    "unique_clicks": 32,
    "expires_at": "2024-01-01T00:00:00Z",
    "is_expired": true,
    "has_reached_max_clicks": false
}
```

---

### Resumo da Conta

**Request:**
```http
GET {{api_url}}/urls/summary/
Authorization: Bearer {{access_token}}
```

Aceita os mesmos filtros da lista (`?search=`, `?is_active=`) e responde sobre
o conjunto todo, não sobre uma página.

**Response (200 OK):**
```json
{
    "links": 12,
    "clicks": 340,
    "unique": 208,
    "down": 3
}
```

`down` conta os links fora do ar por qualquer um dos três motivos: inativo,
expirado ou com o teto de cliques únicos alcançado.

---

## 🔄 Redirecionamento

### 1. Redirecionar URL Ativa

**Request:**
```http
GET {{api_url}}/r/linkedin/
Settings: Desmarcar "Automatically follow redirects"
```

**Response (302 Found):**
```http
HTTP/1.1 302 Found
Location: https://linkedin.com/in/davi-oliveira
Content-Type: text/html; charset=utf-8
```

**Resultado:** Redireciona para URL original e registra click!

---

### 2. URL Inativa (Erro 403)

**Request:**
```http
GET {{api_url}}/r/linkedin/
(após desativar a URL)
```

**Response (403 Forbidden):**
```json
{
    "error": "Link inativo",
    "short_code": "linkedin"
}
```

---

### 3. URL Expirada (Erro 403)

**Request:**
```http
GET {{api_url}}/r/expired-promo/
```

**Response (403 Forbidden):**
```json
{
    "error": "Link expirado",
    "short_code": "expired-promo"
}
```

---

### 4. Limite de Cliques Atingido (Erro 403)

**Request:**
```http
GET {{api_url}}/r/promo2025/
(após atingir max_clicks)
```

**Response (403 Forbidden):**
```json
{
    "error": "Limite de cliques atingido",
    "short_code": "promo2025"
}
```

---

### 5. URL Não Encontrada (Erro 404)

**Request:**
```http
GET {{api_url}}/r/naoexiste123/
```

**Response (404 Not Found):**
```json
{
    "error": "URL encurtada não encontrada",
    "short_code": "naoexiste123",
    "message": "O código fornecido não corresponde a nenhuma URL cadastrada"
}
```

---

### 6. Verificar Click Registrado

**Após redirecionar, verificar estatísticas:**

**Request:**
```http
GET {{api_url}}/urls/linkedin/statistics/
```

**Response (200 OK):**
```json
{
    "short_code": "linkedin",
    "total_clicks": 43,
    "unique_clicks": 29,
    "recent_clicks": [
        {
            "id": 29,
            "ip_address": "172.18.0.1",
            "user_agent": "PostmanRuntime/7.36.0",
            "referer": "",
            "clicked_at": "2024-12-01T16:00:00.123456Z"
        }
    ]
}
```

**Observação:** total_clicks aumentou de 42 para 43! ✅

---

## ❌ Erros Comuns

### 1. URL Inválida (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "github.com/davioliveira"
}

Response:
{
    "original_url": [
        "Entrar um URL válido."
    ]
}
```

---

### 2. Código Muito Curto (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "https://example.com",
    "short_code": "ab"
}

Response:
{
    "short_code": [
        "Codigo curto deve ter no minimo 3 caracteres."
    ]
}
```

---

### 3. Código com Caracteres Especiais (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "https://example.com",
    "short_code": "test@123"
}

Response:
{
    "short_code": [
        "Use apenas letras sem acento, numeros e hifen, sem comecar nem terminar em hifen."
    ]
}
```

---

### 4. Código Duplicado (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "https://example.com",
    "short_code": "linkedin"
}

Response:
{
    "short_code": [
        "Este codigo curto ja esta em uso. Escolha outro."
    ]
}
```

---

### 5. Data de Expiração no Passado (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "https://example.com",
    "expires_at": "2020-01-01T00:00:00Z"
}

Response:
{
    "expires_at": [
        "Data de expiracao deve ser no futuro"
    ]
}
```

---

### 6. Max Clicks Zero ou Negativo (400)
```json
POST {{api_url}}/urls/
{
    "original_url": "https://example.com",
    "max_clicks": 0
}

Response:
{
    "max_clicks": [
        "Numero maximo de cliques deve ser maior que zero."
    ]
}
```

> Isso vale na **criação**, onde não enviar o campo já significa ilimitado. No
> `PATCH`, `0` é aceito: é o caminho de volta ao ilimitado para um link que
> tinha teto.

---

### 7. Teto de Criação Alcançado (429)
```json
POST {{api_url}}/urls/

Response:
{
    "detail": "Request was throttled. Expected available in 3542 seconds."
}
```

O limite é por IP para quem não está autenticado e por conta para quem está,
com folga bem maior no segundo caso. Os dois valores vêm do `.env`
(`THROTTLE_LINK_ANON` e `THROTTLE_LINK_USER`). Só a criação é limitada — ler,
editar e redirecionar não passam por teto.

---

## 📝 Variáveis de Ambiente (Postman)

Configure estas variáveis no seu ambiente:

| Variável | Valor |
|----------|-------|
| `base_url` | `http://localhost:8000` |
| `api_url` | `{{base_url}}/api` |
| `short_code` | *(gerado dinamicamente nos testes)* |
| `auto_short_code` | *(gerado dinamicamente nos testes)* |
| `custom_short_code` | *(gerado dinamicamente nos testes)* |

---

## 🔗 Links Úteis

- **API Base:** http://localhost:8000/api/urls/
- **Admin:** http://localhost:8000/admin/
- **Documentação:** [README.md](../README.md)
- **Postman Collection:** [postman_collection.json](postman_collection.json)
