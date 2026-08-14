# Backend-only image. Multi-stage: install production deps in one stage, then
# copy just those + the source into a lean runtime stage that runs unprivileged.

# --- Stage 1: production dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Stage 2: runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run as the unprivileged `node` user; keep the audit-log directory writable.
RUN mkdir -p /app/logs && chown -R node:node /app
USER node

EXPOSE 3001
CMD ["node", "server.js"]
