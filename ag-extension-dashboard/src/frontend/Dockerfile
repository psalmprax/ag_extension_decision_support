# Common Frontend Build Stage
FROM node:18-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Development Stage
FROM base AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build Stage
FROM base AS build
COPY . .
RUN npm run build

# Production Stage (using nginx)
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
