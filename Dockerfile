# Stage 1: Install dependencies
FROM node:20-slim AS deps

ARG GITHUB_TOKEN
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config and all package.json files
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/typescript-config/package.json packages/typescript-config/

RUN GITHUB_TOKEN=${GITHUB_TOKEN} pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build

COPY packages/typescript-config/ packages/typescript-config/
COPY packages/db/ packages/db/
COPY apps/api/ apps/api/

RUN pnpm --filter @finchly/db build && pnpm --filter @finchly/api build

# Stage 3: Production
FROM node:20-slim AS prod

ARG GITHUB_TOKEN
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/typescript-config/package.json packages/typescript-config/

RUN GITHUB_TOKEN=${GITHUB_TOKEN} pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=build /app/packages/typescript-config/ packages/typescript-config/
COPY --from=build /app/packages/db/dist/ packages/db/dist/
COPY --from=build /app/apps/api/dist/ apps/api/dist/

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
