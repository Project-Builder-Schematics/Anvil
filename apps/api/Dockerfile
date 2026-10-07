FROM oven/bun:1 AS build
WORKDIR /repo
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx nx build api

FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY apps/api/package.json ./
RUN bun install --production

FROM node:24-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
