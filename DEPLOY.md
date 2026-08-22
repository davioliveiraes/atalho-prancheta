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

## 9. Backup automático

O que não pode ser perdido é o banco e os QR Codes. O
[`deploy/backup.sh`](deploy/backup.sh) cuida dos dois.

### Instalar

```bash
sudo crontab -e
```

Acrescente, trocando o caminho pelo lugar onde você clonou:

```
15 3 * * * /root/atalho-prancheta/deploy/backup.sh >> /var/log/atalho-backup.log 2>&1
```

É o crontab do root porque o script escreve em `/var/backups` e conversa com o
Docker. Se preferir rodar como outro usuário, ele precisa estar no grupo
`docker` e ter permissão de escrita no diretório de backup.

### O que ele faz

Toda madrugada, em `/var/backups/atalho-prancheta`:

| Arquivo | Conteúdo |
|---|---|
| `banco-AAAA-MM-DD-HHMM.sql.gz` | `pg_dump` do Postgres |
| `media-AAAA-MM-DD-HHMM.tar.gz` | o volume dos QR Codes |

Guarda 14 dias e apaga o resto. Para mudar qualquer coisa, é variável de
ambiente na própria linha do cron:

```
15 3 * * * KEEP_DAYS=30 BACKUP_DIR=/mnt/hd/backups /root/atalho-prancheta/deploy/backup.sh >> /var/log/atalho-backup.log 2>&1
```

Três cuidados que o script toma, e que valem saber:

- **Dump que falha não vira backup.** Sem isso, um `pg_dump` interrompido ainda
  produziria um `.gz` válido — vazio — e o backup se diria bem-sucedido até o
  dia da restauração. O script confere o código de saída, a integridade do gzip
  e o tamanho mínimo, e sai com erro em qualquer um dos três.
- **Nada de arquivo pela metade.** Ele escreve em `.parcial` e só renomeia no
  fim; uma execução interrompida não deixa um arquivo com nome de backup
  completo.
- **Uma execução por vez.** Se a de ontem ainda estiver rodando, a de hoje
  desiste em vez de disputar o mesmo arquivo.

### Conferir

```bash
tail -20 /var/log/atalho-backup.log
ls -lh /var/backups/atalho-prancheta
```

O script sai com código diferente de zero quando falha, então o cron manda
e-mail se a máquina tiver isso configurado.

### Mandar para fora da VPS

Backup que mora no mesmo disco do banco não é backup — o disco é justamente a
coisa que pode morrer. Com o [rclone](https://rclone.org/) configurado, basta
apontar o destino:

```
15 3 * * * BACKUP_REMOTE=b2:atalho-backups /root/atalho-prancheta/deploy/backup.sh >> /var/log/atalho-backup.log 2>&1
```

Serve qualquer destino que o rclone conheça: Backblaze B2, S3, Google Drive,
outra máquina por SFTP.

### Restaurar

Num banco vazio, e não por cima do que existe:

```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U "$DB_USER" -c "CREATE DATABASE restauracao"
gunzip -c /var/backups/atalho-prancheta/banco-2026-08-21-0315.sql.gz |   docker compose -f docker-compose.prod.yml exec -T db psql -U "$DB_USER" -d restauracao
```

Os QR Codes voltam para o volume:

```bash
docker run --rm -v atalho-prancheta_media_volume:/media -v /var/backups/atalho-prancheta:/origem   alpine tar xzf /origem/media-2026-08-21-0315.tar.gz -C /media
```

> **Faça isso uma vez, agora, sem precisar.** Restaure num banco descartável e
> confira que os dados estão lá:
>
> ```bash
> docker compose -f docker-compose.prod.yml exec -T db >   psql -U "$DB_USER" -d restauracao -tAc "select count(*) from shortener_shortenedurl"
> ```
>
> Backup que nunca foi restaurado é uma suposição, não um backup. Depois é só
> `DROP DATABASE restauracao`.

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

**Endereço dos links.** O código responde na raiz:
`https://seudominio.com.br/{codigo}`. Isso divide a raiz do domínio entre os
links e as telas da interface, e é o `location` por expressão do
[`deploy/nginx/default.conf.template`](deploy/nginx/default.conf.template) que
separa os dois — a lista de nomes excluídos ali é a mesma de
`backend/shortener/reserved.py`. **Criou tela nova na interface? O nome dela
entra nos dois lugares**, senão um link pode roubar a rota.

O endereço antigo, `/api/r/{codigo}/`, continua respondendo: os QR Codes já
impressos apontam para ele.
