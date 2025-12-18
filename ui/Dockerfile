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
    openssh-client

RUN ln -sf /usr/bin/python3 /usr/bin/python || true

RUN yarn config set registry https://mirror-npm.runflare.com && \
    yarn config set disturl hthttps://mirror-npm.runflare.com/dist && \
    yarn config set sass_binary_site hhttps://mirror-npm.runflare.com/mirrors/node-sass/

COPY package*.json ./
RUN yarn install 

# مرحله دوم: ایمیج نهایی خیلی سبک
FROM node:20-alpine
WORKDIR /app

# فقط runtime dependencies (git و ssh فقط برای نصب لازم بود، ولی بعضی وقتا هنوز نیازه)
RUN apk add --no-cache git openssh-client

COPY --from=builder /app/node_modules ./node_modules
COPY src/ src/
COPY public/ public/ 
COPY package.json ./

VOLUME [ "/app/db", "/app/.env" ]

EXPOSE 3000

CMD ["node", "src/server.js"]