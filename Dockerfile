# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --production --ignore-scripts

ENV NODE_ENV=production

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 4096) + '/global/health').then(r => r.json()).then(d => { if(!d.healthy) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
