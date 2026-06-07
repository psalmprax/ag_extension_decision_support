# ============================================================
# Stage 1: Build — install deps + compile TypeScript + Vite
# ============================================================
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY . .
RUN npm run build:docker

# ============================================================
# Stage 2: Development — hot-reload with Vite dev server
# ============================================================
FROM node:20-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ============================================================
# Stage 3: Production — nginx serving static assets
# ============================================================
FROM nginx:alpine AS production

# Install tini for signal handling
RUN apk add --no-cache tini

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config with CSP headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["nginx", "-g", "daemon off;"]
