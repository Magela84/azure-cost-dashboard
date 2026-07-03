# Backend-only image. Multi-stage: install production deps in one stage, then
# copy just those + the source into a lean runtime stage.
#
# NOTE: Node 18 is requested here, but it reached end-of-life in April 2025 —
# bump to `node:20-alpine` (current LTS) when you can; it's a one-line change.

# --- Stage 1: production dependencies ---
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Stage 2: runtime ---
FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
