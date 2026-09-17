# ---------------- 构建阶段 ----------------
FROM node:20-alpine AS build
WORKDIR /app

# 依赖单独成层：只有 lockfile 变化时才重新安装
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------------- 运行阶段 ----------------
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Nezha Aurora" \
      org.opencontainers.image.description="Nezha Monitor V2 user frontend theme with built-in reverse proxy" \
      org.opencontainers.image.source="https://github.com/guanxi660-crypto/nezha-aurora" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/dist /usr/share/nginx/html

# 反代模板：容器启动时由 nginx 官方 entrypoint 渲染为 /etc/nginx/conf.d/default.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/10-derive-grpc-backend.sh /docker-entrypoint.d/10-derive-grpc-backend.sh
RUN chmod +x /docker-entrypoint.d/10-derive-grpc-backend.sh

# 哪吒面板地址。容器内访问宿主机上的面板用 host.docker.internal，
# 访问同网络内的容器直接用服务名，例如 http://nezha:8008
ENV NEZHA_BACKEND=http://host.docker.internal:8008

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
