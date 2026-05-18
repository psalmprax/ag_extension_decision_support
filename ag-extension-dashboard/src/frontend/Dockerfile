# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci 2>/dev/null || npm install

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci 2>/dev/null || npm install
COPY . .
RUN npm run build

# ============================================================
# Stage 3: Development
# ============================================================
FROM node:20-slim AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci 2>/dev/null || npm install
COPY . .
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
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["nginx", "-g", "daemon off;"]
