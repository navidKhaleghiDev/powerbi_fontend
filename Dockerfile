# syntax=docker/dockerfile:1
FROM node:22-alpine AS dependencies

WORKDIR /app
ENV HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Bootstrap exactly the pnpm version declared by the project through Nexus.
# An optional BuildKit secret provides registry credentials without image layers.
RUN --mount=type=cache,id=control-center-npm,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm install --global --registry="$(npm config get registry)" \
      "$(node -p 'require("./package.json").packageManager')"

RUN --mount=type=cache,id=control-center-pnpm,target=/pnpm/store \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM dependencies AS development
COPY . .
EXPOSE 3001
CMD ["pnpm", "run", "dev"]

FROM development AS build
RUN pnpm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
