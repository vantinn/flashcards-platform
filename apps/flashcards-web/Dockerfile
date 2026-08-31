FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at container start — the backend URL a deployed image talks to is
# fixed the moment this image is built. Rebuild (with a new --build-arg) to
# point it at a different API.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
# .next/standalone (from next.config.ts's output: "standalone") already
# includes only the node_modules this app actually needs — no separate
# `npm ci --omit=dev` step, unlike the API image.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
USER node
CMD ["node", "server.js"]
