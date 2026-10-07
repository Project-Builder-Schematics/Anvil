FROM oven/bun:1 AS build
WORKDIR /repo
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx nx build web

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
