# Dockerfile.ui – مخصوص node:23-alpine
FROM node:20-alpine AS builder
WORKDIR /app

RUN sed -i 's|http://dl-cdn.alpinelinux.org|https://mirror.arvancloud.ir/alpine/|g' /etc/apk/repositories

RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    vim \
    openssh-client


RUN ln -sf /usr/bin/python3 /usr/bin/python || true

RUN npm config set registry https://mirror-npm.runflare.com && \
    npm config set disturl https://mirror-npm.runflare.com/dist && \
    npm config set sass_binary_site https://mirror-npm.runflare.com/mirrors/node-sass/

COPY package*.json ./
RUN npm install

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache \
    git \
    openssh-client \
    pandoc \
    font-noto \
    font-noto-arabic \
    font-noto-hebrew

COPY --from=builder /app/node_modules ./node_modules
COPY src/ src/
COPY public/ public/ 
COPY package.json ./

VOLUME [ "/app/db", "/app/.env" ]

EXPOSE 3000

CMD ["node", "src/server.js"]
