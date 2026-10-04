FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.9.1
COPY package.json pnpm-lock.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile && pnpm approve-builds --all --dir web
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY web ./web
RUN pnpm run build

FROM node:22-slim AS runtime
WORKDIR /app
RUN npm install -g pnpm@12.9.1 \
  && groupadd --gid 10001 bot \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin bot
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
RUN mkdir -p /data && chown bot:bot /data
USER bot
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
