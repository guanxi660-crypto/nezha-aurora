#!/bin/sh
# Aurora 容器入口：先推导 NEZHA_GRPC_BACKEND，再交给 nginx 官方 entrypoint。
#
# 为什么不能把推导放进 /docker-entrypoint.d/：官方 entrypoint 对可执行的 *.sh
# 是「子进程执行」（launching $f，export 不回传父进程），不可执行的 *.sh 直接忽略
# （只有 *.envsh 才 source，且也在管道子 shell 里，同样传不出去）。
# 因此 entrypoint.d 里的任何脚本都无法把推导结果带给 20-envsubst-on-templates.sh，
# 模板里的 ${NEZHA_GRPC_BACKEND} 会原样残留，nginx 因未知变量启动失败。
# 在 exec 官方入口之前推导是唯一可靠的时机。
set -eu

backend="${NEZHA_BACKEND:-}"
# 显式指定的 NEZHA_GRPC_BACKEND 永远优先，不被推导覆盖。
if [ -z "${NEZHA_GRPC_BACKEND:-}" ] && [ -n "$backend" ]; then
  # 原协议决定默认端口：HTTPS 面板的 gRPC 走 443，HTTP 走 80；显式端口优先。
  case "$backend" in
    https://*) default_port=443 ;;
    http://*)  default_port=80 ;;
    *)         default_port=80 ;;
  esac

  # 只保留 host[:port]：去协议、去 path/query/fragment、去 userinfo。
  # 例：https://panel.example.com/nezha/ -> panel.example.com -> panel.example.com:443
  hostport=$(printf '%s' "$backend" \
    | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#[/?#].*$##; s#^[^@]*@##')

  # 推导结果必须非空，否则 grpc_pass 会渲染成 grpc://; 让 nginx 启动失败。
  if [ -z "$hostport" ]; then
    echo "aurora-entrypoint: 无法从 NEZHA_BACKEND 推导 gRPC 后端（${backend}）" >&2
    exit 1
  fi

  case "$hostport" in
    *:*) NEZHA_GRPC_BACKEND="$hostport" ;;             # 已含显式端口，含 [::1]:8008
    *)   NEZHA_GRPC_BACKEND="${hostport}:${default_port}" ;;
  esac
  export NEZHA_GRPC_BACKEND
fi

if [ -z "${NEZHA_GRPC_BACKEND:-}" ]; then
  echo "aurora-entrypoint: NEZHA_BACKEND 与 NEZHA_GRPC_BACKEND 均为空，无法渲染 grpc_pass" >&2
  exit 1
fi

exec /docker-entrypoint.sh "$@"
