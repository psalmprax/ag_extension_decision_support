# ============================================================
# Stage 1: Dependencies — install ALL deps (dev + prod)
# ============================================================
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy only dependency manifests first for maximum layer caching
COPY package*.json ./
COPY prisma/ ./prisma/

RUN npm ci --only=production 2>/dev/null || npm install --include=prod && \
    npm prune --production 2>/dev/null; exit 0

# ============================================================
# Stage 2: Build — install devDeps + compile TypeScript
# ============================================================
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma/ ./prisma/

# Install ALL dependencies including devDeps
RUN npm ci 2>/dev/null || npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ============================================================
# Stage 3: Development — hot-reload with ts-node-dev
# ============================================================
FROM node:20-slim AS development
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install dependencies with devDeps for ts-node-dev
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci 2>/dev/null || npm install
RUN npx prisma generate

# Copy all source for hot-reload
COPY . .

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ============================================================
# Stage 4: Production — minimal runtime image
# ============================================================
FROM node:20-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*

# Copy production node_modules only
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled output + prisma schema
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

# Copy prisma-generated client from build stage
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001

# Use tini as init process for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
