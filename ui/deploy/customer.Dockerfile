# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY modules ./modules
COPY packages ./packages
COPY deploy/examples ./deploy/examples
COPY deploy/entrypoint.mjs ./deploy/entrypoint.mjs
COPY deploy/web-security-headers.mjs ./deploy/web-security-headers.mjs
COPY tsconfig.target.json ./
RUN npm ci --ignore-scripts
ARG CUSTOMER
RUN test -f "deploy/examples/${CUSTOMER}/platform.cjson" \
 && cp "deploy/examples/${CUSTOMER}/brand/logo.svg" apps/web/static/brand/logo.svg \
 && cp "deploy/examples/${CUSTOMER}/brand/favicon.svg" apps/web/static/brand/favicon.svg \
 && npm run build:web \
 && mkdir -p dist \
 && ./node_modules/.bin/esbuild apps/api/src/index.ts --bundle --platform=node --format=esm --external:@aws-sdk/* --external:express --external:multer --external:pdfjs-dist --external:pg --outfile=dist/target-api.js --metafile=dist/target-api.meta.json \
 && ./node_modules/.bin/esbuild apps/worker/src/index.ts --bundle --platform=node --format=esm --external:@aws-sdk/* --external:express --external:multer --external:pdfjs-dist --external:pg --outfile=dist/target-worker.js --metafile=dist/target-worker.meta.json \
 && ./node_modules/.bin/esbuild packages/persistence/src/target-migrate.ts --bundle --platform=node --format=esm --external:@aws-sdk/* --external:express --external:multer --external:pdfjs-dist --external:pg --outfile=dist/target-migrate.js

FROM ${NODE_IMAGE} AS runtime_base
WORKDIR /app
RUN apt-get update && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends ca-certificates libreoffice-writer tini util-linux bubblewrap \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /etc/targoman /app/apps/web/static/brand /tmp/targoman \
 && chown -R node:node /tmp/targoman
COPY deploy/runtime/package.json deploy/runtime/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --registry=https://registry.npmjs.org \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build /app/apps/web/build ./apps/web/build
COPY --from=build /app/dist ./dist
COPY --from=build /app/packages/file-processing/src/native-parser.mjs ./dist/parser/native-parser.mjs
COPY --from=build /app/packages/persistence/src/target-migrations ./dist/target-migrations
COPY --from=build /app/packages/authentication/data/LICENSE-SecLists.txt ./licenses/LICENSE-SecLists.txt
COPY --from=build /app/apps/web/static/brand ./apps/web/static/brand
COPY --from=build /app/deploy/entrypoint.mjs ./deploy/entrypoint.mjs
COPY --from=build /app/deploy/web-security-headers.mjs ./deploy/web-security-headers.mjs

FROM runtime_base AS runtime
ARG CUSTOMER
ARG ROLE
ARG SOURCE_COMMIT
ARG PLATFORM_VERSION
ARG RELEASE_ID
ARG CONFIG_FINGERPRINT
ARG BUILD_TIMESTAMP
LABEL org.opencontainers.image.source-revision="${SOURCE_COMMIT}" \
      org.opencontainers.image.version="${PLATFORM_VERSION}" \
      org.opencontainers.image.created="${BUILD_TIMESTAMP}" \
      org.targoman.customer="${CUSTOMER}" \
      org.targoman.role="${ROLE}" \
      org.targoman.release-id="${RELEASE_ID}" \
      org.targoman.config-schema-version="1" \
      org.targoman.config-fingerprint="${CONFIG_FINGERPRINT}"
COPY --from=build /app/deploy/examples/${CUSTOMER}/platform.cjson /etc/targoman/platform.cjson
ENV NODE_ENV=production TARGOMAN_ROLE=${ROLE} TARGOMAN_CONFIG_PATH=/etc/targoman/platform.cjson
USER node
ENTRYPOINT ["/usr/bin/tini", "--", "node", "deploy/entrypoint.mjs"]
