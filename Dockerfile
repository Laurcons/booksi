# syntax=docker/dockerfile:1
#
# Production images for both services, in one file with two final targets:
#
#   docker build --target backend  -t bookcsi-api .
#   docker build --target frontend -t bookcsi-web --build-arg VITE_API_URL=https://api.example.com .
#
# The build context is the repository root, not a workspace directory: this is
# an npm-workspaces monorepo and `shared/` is a real dependency of both halves,
# so neither can be built from inside its own folder.
#
# `VITE_API_URL` is a *build* argument rather than runtime configuration
# because Vite inlines it into the bundle — the API origin is baked into the
# frontend image and changing it means rebuilding.

ARG NODE_VERSION=26-alpine
ARG NGINX_VERSION=1.29-alpine

# ---------------------------------------------------------------------------
# Manifests only, so every layer below survives any change that does not touch
# a package.json or the lockfile. The two installs branch from here rather than
# from each other: `npm ci` leaves packages it no longer wants behind when it
# runs over an existing tree, and a full dev install is exactly what the
# production install must not inherit.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS manifests
WORKDIR /app

# Prisma's query engine is dynamically linked against OpenSSL; on musl it does
# not find one otherwise and fails at generate time with a platform error.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# ---------------------------------------------------------------------------
# The full dev install, used for compiling — never shipped.
# ---------------------------------------------------------------------------
FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------------------------------------------------------------------------
# shared/ — consumed through its built output by both workspaces, so it has to
# exist on disk before either can be compiled.
# ---------------------------------------------------------------------------
FROM deps AS shared-build
COPY shared/ shared/
RUN npm run build --workspace shared

# ---------------------------------------------------------------------------
# Backend build: Prisma client, then `nest build` into backend/dist.
# ---------------------------------------------------------------------------
FROM shared-build AS backend-build
COPY backend/ backend/
RUN npm run prisma:generate --workspace backend \
 && npm run build --workspace backend

# ---------------------------------------------------------------------------
# Runtime dependencies for the backend: the same lockfile, without devDeps.
#
# Restricting the install to the two workspaces the API needs is what keeps
# React and the rest of the frontend's runtime tree out of this image; note
# that `--include-workspace-root` would put them back, because it widens the
# install to the whole lockfile.
# ---------------------------------------------------------------------------
FROM manifests AS backend-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace backend --workspace shared

# ---------------------------------------------------------------------------
# Backend image.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS backend
WORKDIR /app/backend

RUN apk add --no-cache openssl

ENV NODE_ENV=production
# Applied on start by default: the alternative is a deployment whose schema
# silently lags its code. `prisma migrate deploy` takes an advisory lock, so
# several replicas starting at once is safe. Set to false to run migrations as
# a separate job instead.
ENV RUN_MIGRATIONS=true
ENV PORT=3000

# node_modules carries the generated Prisma client (it is written into
# @prisma/client), which is why it comes from the build stage rather than
# being reinstalled here.
COPY --chown=node:node --from=backend-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=backend-build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --chown=node:node --from=backend-build /app/node_modules/@prisma/client /app/node_modules/@prisma/client
COPY --chown=node:node --from=shared-build /app/shared/dist /app/shared/dist
COPY --chown=node:node --from=shared-build /app/shared/package.json /app/shared/package.json
COPY --chown=node:node --from=backend-build /app/backend/dist ./dist
COPY --chown=node:node --from=backend-build /app/backend/package.json ./package.json
# Migrations and schema, needed by `migrate deploy` — not by the running API.
COPY --chown=node:node --from=backend-build /app/backend/prisma ./prisma

USER node
EXPOSE 3000

# There is no health endpoint, so this checks the only thing that can be
# checked without inventing one: that the port is accepting connections.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(Number(process.env.PORT),'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

# The Prisma CLI is a devDependency of this repo but arrives in the production
# tree anyway, as a dependency of @prisma/client — which is why `migrate
# deploy` can run here without shipping the dev install. It is invoked by path
# rather than through npx so that a version that stopped shipping it fails
# loudly at start instead of silently reaching for the network.
#
# `exec` so node is PID 1 and SIGTERM reaches it — the app closes the database
# pool on shutdown (`enableShutdownHooks`), which only happens if it is told.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then node ../node_modules/prisma/build/index.js migrate deploy; fi && exec node dist/main.js"]

# ---------------------------------------------------------------------------
# Frontend build. VITE_API_URL is read from the build environment by Vite; left
# unset it falls back to http://localhost:3000, which is only ever right for a
# developer's machine.
# ---------------------------------------------------------------------------
FROM shared-build AS frontend-build
ARG VITE_API_URL
COPY frontend/ frontend/
RUN npm run build --workspace frontend

# ---------------------------------------------------------------------------
# Frontend image: static files behind nginx.
# ---------------------------------------------------------------------------
FROM nginx:${NGINX_VERSION} AS frontend

COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

RUN <<'NGINX' cat > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml font/woff font/woff2;

    # Repeated in every location below, not just set here: nginx's add_header
    # does not merge across levels — a location with any add_header of its own
    # drops all of the ones inherited from the server block.
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Vite fingerprints everything under /assets, so those are immutable and
    # index.html is the only file that must never be cached — it is what points
    # at the current bundle.
    location /assets/ {
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location = /index.html {
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Cache-Control "no-cache" always;
    }

    # Client-side routing: every unknown path is a React Router route.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

EXPOSE 80
