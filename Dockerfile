# Multi-stage Dockerfile pro Next.js (build standalone, imagem pequena)
# Usado pelo EasyPanel pra rodar no VPS da Facilita.

# ============================================
# Stage 1: deps — instala dependências
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ============================================
# Stage 2: builder — compila o Next.js
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 3: runner — imagem final, mínima
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ffmpeg pra compressao de video no upload de followup
RUN apk add --no-cache ffmpeg

# Copia só o que o standalone precisa
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
