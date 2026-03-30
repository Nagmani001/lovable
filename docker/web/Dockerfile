ARG NODE_VERSION=24.13.1
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prepare
WORKDIR /app
# since corepack will use the latest pnpm but our package.json has : "packageManager": "pnpm@9.0.0",
COPY package.json .
RUN pnpm add -g turbo
COPY . .
RUN turbo prune web --docker

FROM base AS builder
WORKDIR /app

COPY --from=prepare /app/out/json/ .
RUN pnpm install

COPY --from=prepare /app/out/full/ .

ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL

RUN pnpm build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV HOSTNAME="0.0.0.0"

# Don't run production as root , security problem
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

ENV PORT=5000
EXPOSE 5000
CMD ["node", "apps/web/server.js"]
