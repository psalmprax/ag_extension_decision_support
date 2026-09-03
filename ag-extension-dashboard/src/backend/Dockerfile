# ============================================================
# Stage 1: Dependencies — install production dependencies
# ============================================================
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/*

# Build context is the MONOREPO ROOT (see docker-compose: context: ..) so the shared
# API contract can be vendored into the image. All paths below are root-relative.
ARG BACKEND_DIR=ag-extension-dashboard/src/backend

# Copy only dependency manifests first for maximum layer caching
COPY ${BACKEND_DIR}/package*.json ./
COPY ${BACKEND_DIR}/prisma/ ./prisma/

RUN npm install --omit=dev --no-audit --no-fund && npx prisma generate

# ============================================================
# Stage 2: Build — install devDeps + compile TypeScript
# ============================================================
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/*

ARG BACKEND_DIR=ag-extension-dashboard/src/backend
COPY ${BACKEND_DIR}/package*.json ./
COPY ${BACKEND_DIR}/prisma/ ./prisma/

# Install ALL dependencies including devDeps
RUN npm install --no-audit --no-fund

# Generate Prisma client
RUN npx prisma generate

# Shared API contract (zod) — vendored by scripts/sync-shared-api.js during `npm run build`
COPY ag-extension-shared/src/api/ ./shared-src/api/

# Copy source code
COPY ${BACKEND_DIR}/ ./

# Build TypeScript
RUN npm run build

# ============================================================
# Stage 3: Development — hot-reload with ts-node-dev
# ============================================================
FROM node:20-slim AS development
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl ffmpeg && rm -rf /var/lib/apt/lists/*

# Install dependencies with devDeps for ts-node-dev
ARG BACKEND_DIR=ag-extension-dashboard/src/backend
COPY ${BACKEND_DIR}/package*.json ./
COPY ${BACKEND_DIR}/prisma/ ./prisma/
RUN npm install --no-audit --no-fund
RUN npx prisma generate

# Copy all source for hot-reload
COPY ${BACKEND_DIR}/ ./
# Shared API contract for the dev image (predev hook vendors it into src/shared-api)
COPY ag-extension-shared/src/api/ ./shared-src/api/

RUN chown -R node:node /app
USER node

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ============================================================
# Stage 4: Production — minimal runtime image
# ============================================================
FROM node:20-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini curl ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled output + prisma schema
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
ARG BACKEND_DIR=ag-extension-dashboard/src/backend
COPY ${BACKEND_DIR}/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3001

# tini for signal handling; entrypoint applies pending migrations before boot.
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
