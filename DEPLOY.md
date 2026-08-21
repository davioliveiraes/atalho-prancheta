# 🚀 Deploy na VPS

Passo a passo para subir o Atalho Prancheta numa VPS com Docker, servindo pelo
seu domínio em HTTPS.

A pilha de produção é o [`docker-compose.prod.yml`](docker-compose.prod.yml):
Postgres, Redis, o backend em gunicorn e um nginx que serve a interface e faz o
proxy da API. Só o nginx publica porta — banco, cache e backend ficam na rede
interna do Compose.

```
        internet
           │  80 / 443
           ▼
    ┌──────────────┐   /api/ /admin/   ┌──────────────┐
    │ nginx        │──────────────────▶│ gunicorn     │
    │ interface    │                   │ Django       │
    │ /static /media│                  └───────┬──────┘
    └──────────────┘                           │
                                   ┌───────────┴──────────┐
                                   ▼                      ▼
                            ┌─────────────┐        ┌─────────────┐
                            │ PostgreSQL  │        │ Redis       │
                            └─────────────┘        └─────────────┘
```

---

## 1. Antes de começar

Na VPS:

```bash
curl -fsSL https://get.docker.com | sh
```

Confira que o plugin do Compose veio junto:

```bash
docker compose version
```

No painel de DNS do domínio, um registro **A** apontando para o IP da VPS.
Espere ele propagar antes do passo 4 — o Let's Encrypt vai consultar esse
registro para provar que o domínio é seu:

```bash
dig +short seudominio.com.br
```

Deixe as portas 80 e 443 abertas:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 2. Código e configuração

```bash
git clone https://github.com/davioliveiraes/atalho-prancheta.git
cd atalho-prancheta
cp deploy/.env.prod.example .env
```

Gere a chave secreta (não precisa de imagem nenhuma para isso):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Abra o `.env` e preencha, no mínimo: `SECRET_KEY`, `DOMAIN`, `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS` e `DB_PASSWORD`. Os três do domínio precisam bater entre
si — `ALLOWED_HOSTS` sem esquema, `CSRF_TRUSTED_ORIGINS` com `https://`.

> `DEBUG` fica em `False`. Com `True`, qualquer erro devolve o traceback e a
> configuração inteira para quem estiver do outro lado.

---

## 3. Primeiro build

```bash
docker compose -f docker-compose.prod.yml build
```

---

## 4. Certificado

O nginx não sobe sem o certificado — ele é lido na inicialização. Então a
emissão vem antes, com o certbot ocupando a porta 80 sozinho:

```bash
docker compose -f docker-compose.prod.yml run --rm --service-ports \
  --entrypoint "certbot certonly --standalone --agree-tos --no-eff-email \
  -m voce@exemplo.com -d seudominio.com.br" certbot
```

Troque o e-mail e o domínio. O e-mail recebe o aviso de vencimento, caso a
renovação automática pare por algum motivo.

> Se quiser atender também em `www.seudominio.com.br`, acrescente
> `-d www.seudominio.com.br` no comando acima e o mesmo nome no `server_name`
> de [`deploy/nginx/default.conf.template`](deploy/nginx/default.conf.template).

---

## 5. Subir

```bash
docker compose -f docker-compose.prod.yml up -d
```

O backend aplica as migrações e roda o `collectstatic` antes de abrir o
gunicorn. Acompanhe:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

Crie a conta do admin:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Se já havia links criados antes das contas existirem, adote-os:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py adotar_links voce@exemplo.com --simular
```

---

## 6. Conferir

```bash
# Saúde do backend — é o que o Compose também consulta
curl -s https://seudominio.com.br/api/health/

# Interface
curl -sI https://seudominio.com.br | head -1

# http tem que desviar para https
curl -sI http://seudominio.com.br | head -2

# A API responde e a listagem pede conta
curl -s -o /dev/null -w "%{http_code}\n" https://seudominio.com.br/api/urls/

# Crie um link e abra o QR Code que ele devolve — é o teste de que o /media/
# está sendo servido pelo nginx.
curl -s -X POST https://seudominio.com.br/api/urls/ \
  -H "Content-Type: application/json" \
  -d '{"original_url": "https://exemplo.com"}'
```

E entre no admin em `https://seudominio.com.br/admin/`. Se o login responder
403, o `CSRF_TRUSTED_ORIGINS` está faltando ou escrito diferente do domínio.

---

## 7. Renovação do certificado

O serviço `certbot` da pilha tenta renovar a cada 12 horas e o Let's Encrypt só
renova de fato quando falta menos de 30 dias. O nginx recarrega a configuração
no mesmo intervalo, então o certificado novo entra em uso sozinho.

Para conferir sem esperar:

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint "certbot certificates" certbot
```

---

## 8. Atualizar a aplicação

```bash
cd atalho-prancheta
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

As migrações rodam sozinhas na subida do backend. Os volumes de banco e de
mídia não são tocados por um build.

---

## 9. Backup

O que não pode ser perdido é o banco e os QR Codes.

```bash
# As credenciais do banco vivem no .env; traga-as para a sessão do shell.
set -a; . ./.env; set +a

# Banco
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > backup-$(date +%F).sql.gz

# QR Codes
docker run --rm -v atalho-prancheta_media_volume:/media -v "$PWD":/destino \
  alpine tar czf /destino/media-$(date +%F).tar.gz -C /media .
```

Para restaurar o banco num ambiente vazio:

```bash
gunzip -c backup-2026-08-21.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U "$DB_USER" "$DB_NAME"
```

Vale colocar as duas linhas de backup num cron diário e mandar o arquivo para
fora da VPS — backup que mora no mesmo disco não é backup.

---

## Notas

**Desenvolvimento continua igual.** O `docker-compose.yml` da raiz é o de
desenvolvimento e não foi tocado: `docker compose up -d` na sua máquina segue
subindo o Vite com HMR e o `runserver`. O perfil `prod` dele
(`docker compose --profile prod up`) serve para conferir o build estático em
`localhost:8080`, sem TLS — é outra coisa, não o servidor.

**O nginx da VPS.** A imagem do frontend traz o `frontend/nginx.conf`, que é o
do perfil de desenvolvimento. Em produção o
[`deploy/nginx/default.conf.template`](deploy/nginx/default.conf.template) é
montado sobre ele e vence, com o `${DOMAIN}` preenchido pelo `envsubst` na
inicialização do container.

**Mídia.** Os QR Codes são servidos pelo nginx a partir do volume, e não pelo
Django: com `DEBUG=False` o `static()` do `config/urls.py` devolve lista vazia,
então nada sob `/media/` sairia pelo gunicorn.

**Endereço dos links.** O código encurtado responde em
`https://seudominio.com.br/api/r/{codigo}/`. Se quiser encurtar o próprio
endereço — servir em `/{codigo}` direto — é uma mudança de rota no backend e no
`redirectUrl` do frontend, e quebra os links já divulgados.
