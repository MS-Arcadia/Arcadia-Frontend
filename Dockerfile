# syntax=docker/dockerfile:1
#
# Build:  docker build -t arcadia/frontend:local .
#
# Three stages, because dependencies, the build and the runtime want different
# things in the image. Only the third one ships: `next build` with
# `output: "standalone"` traces the files the server actually needs, so the runner
# carries neither pnpm nor a full node_modules.

# ---------------------------------------------------------------------------- #
#  Stage 1 — dependencies                                                      #
# ---------------------------------------------------------------------------- #
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

# Manifests before source, so a code-only change reuses this layer. The
# workspace file is copied too: without it pnpm resolves differently here than
# it does on a developer's machine, which is how a lockfile drifts silently.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------- #
#  Stage 2 — build                                                             #
# ---------------------------------------------------------------------------- #
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.18.2 --activate

WORKDIR /app

# `NEXT_PUBLIC_*` is inlined into the client bundle at build time, so these are
# build arguments rather than runtime environment. Changing where the API lives
# means rebuilding the image — that is a property of Next, not a choice here, and
# it is worth knowing before somebody tries to repoint a running container.
#
# The default is `mock`, so an image built with no arguments is a complete,
# demonstrable storefront rather than one that fails on its first request.
ARG NEXT_PUBLIC_API_MODE=mock
ARG NEXT_PUBLIC_API_URL=/api

ENV NEXT_PUBLIC_API_MODE=${NEXT_PUBLIC_API_MODE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN echo ">>> building with API_MODE=${NEXT_PUBLIC_API_MODE} API_URL=${NEXT_PUBLIC_API_URL}" \
 && pnpm run build

# ---------------------------------------------------------------------------- #
#  Stage 3 — runtime                                                           #
# ---------------------------------------------------------------------------- #
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Without this the standalone server binds to localhost inside the container and
# nothing outside it can reach the port.
ENV HOSTNAME=0.0.0.0

# A dedicated unprivileged user, matching the other services in this platform.
# Running as root in a container buys nothing and turns a container escape into a
# host compromise.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The standalone tree, then the two things it deliberately leaves out: the static
# chunks and `public/`.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER 1001:1001

ARG VERSION=dev
ENV SERVICE_VERSION=${VERSION}

EXPOSE 3000

# Node is in the image, so the check needs no extra tooling. It asks for the
# landing page rather than a health route: this app has no API of its own, so
# "can it render" is the only useful liveness question.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["node", "server.js"]
