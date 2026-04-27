# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG WEB_BUILD_NODE_OPTIONS=--max-old-space-size=512

RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories \
 && apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY web/package.json web/package-lock.json ./web/

RUN npm config set registry "${NPM_REGISTRY}" \
 && npm ci --prefix server --no-audit --no-fund --prefer-offline \
 && npm ci --prefix web    --no-audit --no-fund --prefer-offline

COPY server ./server
COPY web ./web

RUN npm --prefix server run prisma:generate
RUN NODE_OPTIONS="${WEB_BUILD_NODE_OPTIONS}" npm --prefix web run build
RUN npm --prefix server run build

# Strip devDeps from server — save the generated prisma client first
RUN cp -r server/node_modules/.prisma /tmp/prisma-generated \
 && npm ci --prefix server --omit=dev --no-audit --no-fund --prefer-offline \
 && cp -r /tmp/prisma-generated server/node_modules/.prisma

# ---------- runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

RUN sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories \
 && apk add --no-cache openssl

ENV NODE_ENV=production \
    PORT=5174 \
    HOST=0.0.0.0 \
    DATABASE_URL="file:/app/server/data/ops-pilot.db" \
    NODE_OPTIONS="--max-old-space-size=256"

COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/node_modules  ./server/node_modules
COPY --from=builder /app/server/dist          ./server/dist
COPY --from=builder /app/server/prisma        ./server/prisma
COPY --from=builder /app/web/dist             ./web/dist

RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]
EXPOSE 5174

WORKDIR /app/server
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
