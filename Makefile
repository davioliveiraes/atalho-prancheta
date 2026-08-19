.PHONY: help venv install install-dev front-install build up down logs backend-shell frontend-shell migrate makemigrations createsuperuser test lint format check clean clean-front reset

# Cores para output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m # No Color

help: ## Mostra esta ajuda
	@echo "$(GREEN)Comandos disponíveis:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'

venv: ## Recria a venv local com Python 3.14
	rm -rf venv
	py -3.14 -m venv venv
	venv/Scripts/python -m pip install --upgrade pip setuptools wheel

install: ## Instala dependências de runtime na venv
	venv/Scripts/python -m pip install -r backend/requirements.txt

install-dev: ## Instala dependências de runtime + desenvolvimento na venv
	venv/Scripts/python -m pip install -r backend/requirements-dev.txt

front-install: ## Instala dependências do frontend (limpo)
	cd frontend && npm ci

build: ## Constrói as imagens Docker
	docker compose build

up: ## Inicia os containers
	docker compose up

down: ## Para os containers
	docker compose down

logs: ## Mostra logs dos containers
	docker compose logs -f

backend-shell: ## Abre shell no container backend
	docker compose exec backend bash

frontend-shell: ## Abre shell no container frontend
	docker compose exec frontend sh

migrate: ## Aplica migrações do banco
	docker compose run --rm backend python manage.py migrate

makemigrations: ## Cria novas migrações
	docker compose run --rm backend python manage.py makemigrations

createsuperuser: ## Cria superusuário
	docker compose run --rm backend python manage.py createsuperuser

test: ## Roda testes
	docker compose run --rm backend python manage.py test

lint: ## Roda pylint em todo o código
	pylint --rcfile=backend/.pylintrc backend/config/ backend/shortener/

format: ## Formata código com black e isort
	black --config=backend/pyproject.toml backend/
	isort --settings-path=backend/pyproject.toml backend/

check: ## Roda todas as verificações
	@echo "$(GREEN)Rodando pre-commit em todos os arquivos...$(NC)"
	pre-commit run --all-files

clean-front: ## Remove node_modules/dist do host e o volume de deps do container
	rm -rf frontend/node_modules frontend/dist frontend/*.tsbuildinfo
	-docker volume rm url_shortener_api_frontend_node_modules

clean: ## Remove arquivos temporários
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.log" -delete

reset: ## Reset completo (cuidado!)
	docker compose down -v
	docker compose build --no-cache
	docker compose up
