# bookworm-slim (glibc), not alpine (musl) — bcrypt ships prebuilt native
# binaries for glibc platforms, avoiding a from-source compile at image
# build time. python3/make/g++ are still installed as a fallback for
# whichever exact Node patch version doesn't have a matching prebuilt.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

EXPOSE 3001
USER node
CMD ["node", "dist/main"]
