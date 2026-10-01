# syntax=docker/dockerfile:1.12

# ================================================
# Stage 1: Builder (full build + bundle + obfuscate)
# ================================================
FROM node:22-alpine3.22 AS builder

WORKDIR /app

# Faster mirror + security upgrade (reduces many high CVEs)
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine/|https://mirror.arvancloud.ir/alpine/|' /etc/apk/repositories && \
    apk update && apk upgrade --no-cache

# Build tools for native dependencies during npm ci.
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
COPY cli/               cli/
COPY tsconfig.json      ./
COPY eslint.config.js   ./
COPY obfuscator.config.json ./

# === YOUR PROTECTED BUILD ===
# tsc → esbuild (single file bundle) → javascript-obfuscator (prompts hidden)
RUN npm run prod && npm prune --omit=dev --ignore-scripts

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

# Preserve native addons compiled for the same Node/Alpine version.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Verify the native PDF canvas backend in the final runtime image.
RUN node -e "require('@napi-rs/canvas').createCanvas(1, 1).toBuffer('image/png')"

# Copy the fully bundled + obfuscated single file (prompts are now hidden)
COPY --from=builder /app/dist/index.js ./dist/index.js

ENTRYPOINT ["/sbin/tini", "--"]
EXPOSE 3000

# Run as non-root (best practice)
USER node

CMD ["node", "dist/index.js"]