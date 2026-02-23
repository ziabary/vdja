# Dockerfile.ui 
FROM node:20-alpine AS builder
WORKDIR /app

RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine/v3.23|https://mirror.arvancloud.ir/alpine/v3.21|g' /etc/apk/repositories

RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    vim \
    openssh-client

RUN ln -sf /usr/bin/python3 /usr/bin/python || true
RUN npm config set registry https://mirror-npm.runflare.com 

COPY package*.json ./
RUN npm install

FROM node:20-alpine
WORKDIR /app

RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine/v3.23|https://mirror.arvancloud.ir/alpine/v3.21|g' /etc/apk/repositories

RUN apk add --no-cache \
    git \
    openssh-client \
    poppler-utils \
    tesseract-ocr \
    pandoc \
    font-noto \
    font-noto-arabic \
    font-noto-hebrew     

COPY --from=builder /app/node_modules ./node_modules
COPY src/ src/
COPY public/ public/
COPY package.json ./

# VOLUME [ "/app/.config.json" ]

EXPOSE 3000
ENV SHELL=/bin/sh

CMD ["node", "src/server.js"]

#    "concurrently": "^7.0.0",
#    "eslint": "^8.0.0",
#    "typescript": "^4.0.0",
#    "ts-node": "^10.0.0",
#    "@types/node": "^18.0.0",
#    "@typescript-eslint/eslint-plugin": "^5.0.0",
#    "@typescript-eslint/parser": "^5.0.0"