# --- Stage 1: build ----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Copy only the manifest files first so `npm ci` is cached in its own layer
# and only re-runs when dependencies actually change.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: runtime ----------------------------------------------------------
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
