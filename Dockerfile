FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.9.1

# Copy workspace config and package manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/admin/package.json ./apps/admin/

# Install dependencies for all workspace packages
RUN pnpm install --frozen-lockfile

# Copy source code and build configs
COPY apps/backend ./apps/backend
COPY apps/admin ./apps/admin

# Build admin frontend and backend
RUN pnpm run build

FROM node:22-slim AS runtime
WORKDIR /app
RUN npm install -g pnpm@12.9.1 \
  && groupadd --gid 10001 bot \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin bot

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/admin/dist ./apps/admin/dist

RUN mkdir -p /data && chown bot:bot /data
USER bot
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/backend/dist/index.js"]
