# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:22-slim AS deps
# Preserve the local dependency's ../../../ path recorded in package-lock.json.
WORKDIR /workspace/ag-extension-dashboard/src/frontend
COPY ag-extension-shared /workspace/ag-extension-shared
ENV npm_config_fetch_retries=5 npm_config_fetch_retry_mintimeout=20000 npm_config_fetch_retry_maxtimeout=120000
COPY ag-extension-dashboard/src/frontend/package.json ag-extension-dashboard/src/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:22-slim AS build
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
FROM node:22-slim AS development
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

# Install tini for signal handling
RUN apk add --no-cache tini

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
