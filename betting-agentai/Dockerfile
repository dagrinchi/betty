FROM node:20.11-slim

LABEL version="1.0.0" \
      description="Betting AI Agent" \
      maintainer="dagrinchi"

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_OPTIONS='--no-warnings'

CMD ["pnpm", "start"]