FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/connectors/package.json packages/connectors/
COPY packages/memory/package.json packages/memory/
COPY packages/adaptive/package.json packages/adaptive/
COPY packages/gateway/package.json packages/gateway/
COPY packages/commerce/package.json packages/commerce/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@ygn-stem/gateway", "dev"]
