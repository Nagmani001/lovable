ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN corepack enable && mkdir -p "$PNPM_HOME/bin"

FROM base AS prepare
WORKDIR /app
COPY package.json . 
RUN pnpm add -g turbo
COPY . .
RUN turbo prune worker --docker

FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install

COPY --from=prepare /app/out/full/ .
# no build step since we will use tsx
RUN cd packages/database && pnpm dlx prisma@7.4.1 generate

FROM base AS runner
WORKDIR /app
RUN pnpm add -g tsx

# Don't run production as root , security problem
RUN addgroup --system --gid 1001 worker
RUN adduser --system --uid 1001 worker
USER worker
COPY --from=builder /app .

CMD ["tsx","apps/worker/src/index.ts"] 
