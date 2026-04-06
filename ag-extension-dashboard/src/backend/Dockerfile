# Common Backend Build Stage
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install

# Development Stage
FROM base AS development
COPY . .
# Copy frontend locales for backend translation support
COPY ../frontend/public/locales ./frontend/public/locales
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build Stage
FROM base AS build
COPY . .
# Copy frontend locales for backend translation support
COPY ../frontend/public/locales ./frontend/public/locales
RUN npx prisma generate
RUN npm run build

# Production Stage
FROM node:20-slim AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
# Copy frontend locales for backend translation support
COPY --from=build /app/frontend/public/locales ./frontend/public/locales
EXPOSE 3001
CMD ["npm", "run", "start"]
