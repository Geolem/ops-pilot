# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

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
ENV NODE_ENV=production \
    PORT=5174 \
    HOST=0.0.0.0 \
    DATABASE_URL="file:/app/data/ops-pilot.db"

COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/node_modules  ./server/node_modules
COPY --from=builder /app/server/dist          ./server/dist
COPY --from=builder /app/server/prisma        ./server/prisma
COPY --from=builder /app/web/dist             ./web/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 5174

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
