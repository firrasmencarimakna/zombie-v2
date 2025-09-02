# Tahap 1: Build Aplikasi Next.js
FROM node:20.13.1 AS builder

WORKDIR /app

# Salin file package.json dan lock file yang ada
COPY package.json ./
COPY yarn.lock ./ || true
COPY package-lock.json ./ || true
COPY pnpm-lock.yaml ./ || true

# Install dependensi
RUN yarn install --frozen-lockfile || npm install || pnpm install --frozen-lockfile

# Salin semua file proyek
COPY . .

# Jalankan proses build Next.js
RUN yarn build || npm run build || pnpm run build


# Tahap 2: Jalankan Aplikasi Produksi
FROM node:20.13.1

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
