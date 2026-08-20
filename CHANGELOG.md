# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [1.0.0] - 2024-12-01

### Adicionado

**Core Features:**
- API REST completa com Django REST Framework
- Encurtamento de URLs (código auto-gerado ou customizado)
- Sistema de tracking de cliques (total e únicos por IP)
- URLs com expiração e limite de cliques
- Geração automática de QR Code
- Busca, filtros e estatísticas detalhadas

**API Endpoints (14 endpoints):**
- CRUD completo de URLs
- Ativação/desativação dinâmica
- Estatísticas e QR Code
- Redirecionamento com tracking

**Testes:**
- 53 testes automatizados (100% de sucesso)
- Cobertura de models, serializers, views e redirects
- Tempo de execução: ~1.3s

**Qualidade:**
- Docstrings completas
- Type hints
- Code linting (pylint, black, isort)
- Pre-commit hooks

**Documentação:**
- README completo
- Exemplos de uso (EXAMPLES.md)
- Coleção Postman (29 requests)

**DevOps:**
- Docker & Docker Compose
- PostgreSQL 16
- Ambiente configurável

### Tecnologias

- Python 3.13
- Django 4.2.7
- Django REST Framework 3.14.0
- PostgreSQL 16
- Docker & Docker Compose
- QRCode & Pillow

### Arquitetura

- MVT (Model-View-Template)
- Repository Pattern
- Serializer Pattern
- ViewSet Pattern

---

[1.0.0]: https://github.com/davioliveiraes/atalho/releases/tag/v1.0.0
