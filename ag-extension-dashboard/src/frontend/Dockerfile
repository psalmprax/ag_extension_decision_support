# Node 22 bundles npm 10.9.x which has the edgesOut null crash.
# Upgrade npm once in a shared base, reuse across stages.
FROM node:22-slim AS node-base
ARG NPM_VERSION=11.19.1
RUN npm install --global npm@${NPM_VERSION} --no-audit --no-fund && npm cache clean --force

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node-base AS deps
WORKDIR /workspace/ag-extension-dashboard/src/frontend
COPY ag-extension-shared /workspace/ag-extension-shared
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=300000 \
    npm_config_maxsockets=5
COPY ag-extension-dashboard/src/frontend/package.json ./
RUN for attempt in 1 2 3 4 5; do \
      echo "==> [frontend deps] npm install attempt $attempt of 5..." && \
      npm install --no-audit --no-fund && break || { \
        if [ "$attempt" -ge 5 ]; then \
          echo "❌ [frontend deps] npm install failed after $attempt attempts" >&2; \
          exit 1; \
        fi; \
        echo "⚠️ [frontend deps] npm install failed on attempt $attempt; cleaning cache and retrying in 10s..." >&2; \
        npm cache clean --force 2>/dev/null || true; \
        sleep 10; \
      }; \
    done

# ============================================================
# Stage 2: Build
# ============================================================
FROM node-base AS build
WORKDIR /workspace/ag-extension-dashboard/src/frontend
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY --from=deps /workspace/ag-extension-dashboard/src/frontend/node_modules ./node_modules
COPY ag-extension-shared /workspace/ag-extension-shared
COPY ag-extension-dashboard/src/frontend/package.json ./
COPY ag-extension-dashboard/src/frontend/ .
# Locale gate scripts live outside the frontend dir; the audit-locales chain
# resolves them at ../../scripts relative to the frontend root.
COPY ag-extension-dashboard/scripts/ /workspace/ag-extension-dashboard/scripts/
RUN npm run build:docker && npm run check:bundle

# ============================================================
# Stage 3: Development
# ============================================================
FROM node-base AS development
WORKDIR /workspace/ag-extension-dashboard/src/frontend
COPY --from=deps /workspace/ag-extension-dashboard/src/frontend/node_modules ./node_modules
COPY ag-extension-shared /workspace/ag-extension-shared
COPY ag-extension-dashboard/src/frontend/package.json ./
COPY ag-extension-dashboard/src/frontend/ .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ============================================================
# Stage 4: Production with nginx + security headers
# ============================================================
FROM nginx:alpine AS production

# Upgrade Alpine packages to patch upstream CVEs (e.g. pcre2, libexpat) and install tini
RUN apk upgrade --no-cache && apk add --no-cache tini

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config with CSP headers
COPY ag-extension-dashboard/src/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /workspace/ag-extension-dashboard/src/frontend/dist /usr/share/nginx/html

# Copy ML models to a separate path (served by nginx location /models/) so the
# multi-MB ONNX binary is fetched on demand by the classifier, not shipped in
# the SPA payload or precached by the service worker.
COPY ag-extension-dashboard/src/frontend/models/ /usr/share/nginx/ml/

EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["nginx", "-g", "daemon off;"]
