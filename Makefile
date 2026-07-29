# Arcadia frontend.
#
#   make install   install dependencies
#   make dev       development server
#   make check     typecheck + lint + format check
#   make docker    build the image
#
# The image is built here, not in the infra repository: how a service is built is
# that service's business. `cd infra && make images` calls this target.

SERVICE  := frontend
IMAGE    := arcadia/$(SERVICE)
VERSION  ?= local

# `NEXT_PUBLIC_*` is inlined into the client bundle at build time, so the API mode
# is baked into the image and cannot be changed by an environment variable on a
# running container. Override at build time:
#
#   make docker API_MODE=live API_URL=http://localhost:8090
API_MODE ?= mock
API_URL  ?= /api

.DEFAULT_GOAL := help
.PHONY: help install dev build start check typecheck lint format docker clean

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install --frozen-lockfile

dev: ## Development server on :3000
	pnpm run dev

build: ## Production build
	pnpm run build

start: ## Serve a production build
	pnpm run start

check: ## Everything CI checks: types, lint, formatting
	pnpm run check

typecheck: ## tsc --noEmit
	pnpm run typecheck

lint: ## eslint
	pnpm run lint

format: ## Format in place
	pnpm run format

docker: ## Build the image
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg NEXT_PUBLIC_API_MODE=$(API_MODE) \
		--build-arg NEXT_PUBLIC_API_URL=$(API_URL) \
		-t $(IMAGE):$(VERSION) .
	@echo "built $(IMAGE):$(VERSION) with API_MODE=$(API_MODE)"

clean: ## Remove build output and caches
	rm -rf .next node_modules/.cache
