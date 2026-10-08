# Multi-stage image: Vite build (node) -> static serve with nginx. The canonical image for CI.
# For quick manual deploys, or builders short on memory, use Dockerfile.runtime with a dist/ built on the host.
#
#   docker build -f docker/Dockerfile .
#   docker buildx build -f docker/Dockerfile --secret id=npm,env=NPM_TOKEN --build-arg BUILD_TARGET=production .

# --- Build stage -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Reproducible install from the lockfile. A private registry token, if any, arrives as a BuildKit secret so it never
# lands in an image layer or in `docker history`. It is optional: public packages install without it.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm,required=false sh -euc '\
      if [ -f /run/secrets/npm ]; then \
        printf "//registry.npmjs.org/:_authToken=%s\n" "$(cat /run/secrets/npm)" > .npmrc; \
      fi; \
      npm ci; \
      rm -f .npmrc'

COPY . .

# Vite mode baked into the bundle (reads .env.<mode>).
ARG BUILD_TARGET=production
RUN node --max-old-space-size=8192 node_modules/vite/bin/vite.js build --mode ${BUILD_TARGET}

# --- Runtime stage -----------------------------------------------------------
# nginx binds 8080 as root. Where Pod Security requires runAsNonRoot, use nginxinc/nginx-unprivileged:1.27-alpine.
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
