# Common Frontend Build Stage
FROM node:20-slim AS base
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

# Copy custom nginx config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
