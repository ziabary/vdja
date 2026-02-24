# syntax=docker/dockerfile:1.12

# ================================================
# Stage 1: Builder (full build + bundle + obfuscate)
# ================================================
FROM node:22-alpine3.22 AS builder

WORKDIR /app

# Faster mirror + security upgrade (reduces many high CVEs)
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine/|https://mirror.arvancloud.ir/alpine/|' /etc/apk/repositories && \
    apk update && apk upgrade --no-cache

# Build tools (needed for esbuild + any native deps during npm ci)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git

RUN ln -sf /usr/bin/python3 /usr/bin/python

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL deps (dev + prod) — runs on Alpine → no host incompatibility
RUN npm ci

# Copy source + config
COPY src/               src/
COPY public/            public/
COPY tsconfig.json      ./
COPY obfuscator.config.json ./

# === YOUR PROTECTED BUILD ===
# tsc → esbuild (single file bundle) → javascript-obfuscator (prompts hidden)
RUN npm run prod

# ================================================
# Stage 2: Runtime (minimal, production only)
# ================================================
FROM node:22-alpine3.22

WORKDIR /app

# Same mirror + upgrade (critical for reducing the 6 high vulns you saw)
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine/|https://mirror.arvancloud.ir/alpine/|' /etc/apk/repositories && \
    apk update && apk upgrade --no-cache

# Runtime packages your app needs (PDF/OCR/fonts)
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-fas \
    font-noto \
    font-noto-arabic \
    font-noto-hebrew \
    tini

# Fresh production-only node_modules (no devDeps, smaller + safer)
COPY --from=builder /app/package.json ./
RUN npm ci --only=production --ignore-scripts --no-audit --no-fund

# Copy the fully bundled + obfuscated single file (prompts are now hidden)
COPY --from=builder /app/dist/index.js ./dist/index.js

# Optional: if you have config templates or .env.example
# COPY .env.example ./.env

ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 3000

# Run as non-root (best practice)
USER node

CMD ["node", "dist/index.js"]