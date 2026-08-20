# Guia de Contribuição

Obrigado por considerar contribuir! 🎉

## Como Contribuir

1. **Fork** o repositório
2. **Crie uma branch**: `git checkout -b feature/minha-feature`
3. **Faça suas mudanças** seguindo os padrões
4. **Teste**: `docker compose exec backend python manage.py test`
5. **Commit**: Use [Conventional Commits](https://www.conventionalcommits.org/)
6. **Push**: `git push origin feature/minha-feature`
7. **Abra um Pull Request**

---

## Setup Local
```bash
# Clone e entre no diretório
git clone https://github.com/davioliveiraes/atalho-prancheta.git
cd atalho-prancheta

# Suba os containers
docker compose up -d

# Execute as migrações
docker compose exec backend python manage.py migrate

# Crie um superusuário
docker compose exec backend python manage.py createsuperuser

# Rode os testes
docker compose exec backend python manage.py test shortener.tests
```

---

## Padrões de Código

### Python
- **PEP 8** para estilo
- **Docstrings** em funções/classes públicas
- **Type hints** onde possível
- **Black** para formatação: `black backend/`
- **isort** para imports: `isort backend/`

### Commits
Use o formato: `<tipo>: <descrição>`

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `test`: Testes
- `refactor`: Refatoração
- `style`: Formatação

**Exemplos:**
```bash
feat: add bulk URL creation endpoint
fix: correct click tracking for unique IPs
docs: update installation instructions
test: add validation tests
```

---

## Pull Requests

**Antes de abrir um PR:**
- [ ] Código segue os padrões
- [ ] Todos os testes passam (53 tests OK)
- [ ] Documentação atualizada (se aplicável)
- [ ] Commits seguem o padrão

**Template:**
```markdown
## Descrição
Breve descrição das mudanças

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Documentação

## Como Testar
Passos para testar as mudanças

## Checklist
- [ ] Código testado localmente
- [ ] Testes passando
- [ ] Documentação atualizada
```

---

## Reportar Bugs

Use [GitHub Issues](https://github.com/davioliveiraes/atalho-prancheta/issues) incluindo:
- Descrição do bug
- Passos para reproduzir
- Comportamento esperado vs atual
- Ambiente (SO, Docker version, Python version)

---

## Sugerir Funcionalidades

Use [GitHub Issues](https://github.com/davioliveiraes/atalho-prancheta/issues) com:
- Descrição da funcionalidade
- Problema que resolve
- Solução proposta
- Contexto adicional

---

## Recursos

- [Django Docs](https://docs.djangoproject.com/)
- [DRF Docs](https://www.django-rest-framework.org/)
- [Docker Docs](https://docs.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## Contato

- **Issues**: [GitHub Issues](https://github.com/davioliveiraes/atalho-prancheta/issues)
- **GitHub**: [@davioliveiraes](https://github.com/davioliveiraes)
- **LinkedIn**: [Davi Oliveira](https://linkedin.com/in/davioliveiraes)

---

**Obrigado por contribuir! 🚀**
