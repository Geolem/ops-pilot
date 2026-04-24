# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

# Same openssl version as runtime so prisma generate picks the right engine binary
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories \
 && apk add --no-cache openssl

COPY package.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN npm install --prefix server --no-audit --no-fund \
 && npm install --prefix web    --no-audit --no-fund

COPY server ./server
COPY web ./web

RUN npm --prefix server run prisma:generate \
 && npm --prefix web    run build \
 && npm --prefix server run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

# Prisma's schema engine needs openssl at runtime
RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories \
 && apk add --no-cache openssl

ENV NODE_ENV=production \
    PORT=5174 \
    HOST=0.0.0.0 \
    DATABASE_URL="file:/app/server/data/ops-pilot.db"

COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/node_modules  ./server/node_modules
COPY --from=builder /app/server/dist          ./server/dist
COPY --from=builder /app/server/prisma        ./server/prisma
COPY --from=builder /app/web/dist             ./web/dist

RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]
EXPOSE 5174

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
