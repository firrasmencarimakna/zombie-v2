# Tahap 1: Build Aplikasi Next.js
FROM node:20.13.1 AS builder

WORKDIR /app

# Salin package.json dan lock file khusus pnpm
# Docker akan menemukan file ini dengan pasti
COPY package.json pnpm-lock.yaml ./

# Install dependensi menggunakan pnpm
# `pnpm` harus diinstal terlebih dahulu
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Salin semua file proyek ke direktori kerja
COPY . .

# Jalankan proses build Next.js
RUN pnpm run build



# Tahap 2: Jalankan Aplikasi Produksi
FROM node:20.13.1

WORKDIR /app

# Salin folder `standalone` dan `public`
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public

# Tentukan port aplikasi
ENV PORT=3000

# Ekspos port
EXPOSE 3000

# Perintah untuk menjalankan aplikasi
CMD ["node", "server.js"]
