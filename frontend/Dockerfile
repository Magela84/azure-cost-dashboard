# Frontend image. Multi-stage: build the React app, then serve the static files
# with an UNPRIVILEGED nginx (which also proxies /api to the backend service).
#
# nginx binds port 8080 because a non-root process cannot bind port 80.

# --- Stage 1: build the SPA ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: serve with nginx (non-root) ---
FROM nginx:alpine
# Hand the dirs nginx must write (html, cache, logs, pid) to the nginx user.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
