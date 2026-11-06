#!/bin/sh
# Aurora 容器入口：先推导 NEZHA_GRPC_BACKEND，再交给 nginx 官方 entrypoint。
#
# 为什么不能把推导放进 /docker-entrypoint.d/：官方 entrypoint 对可执行的 *.sh
# 是「子进程执行」（launching $f，export 不回传父进程），不可执行的 *.sh 直接忽略
# （只有 *.envsh 才 source，且也在管道子 shell 里，同样传不出去）。
# 因此 entrypoint.d 里的任何脚本都无法把推导结果带给 20-envsubst-on-templates.sh，
# 模板里的 ${NEZHA_GRPC_BACKEND} 会原样残留，nginx 因未知变量启动失败。
# 在 exec 官方入口之前推导是唯一可靠的时机。
set -e

if [ -z "${NEZHA_GRPC_BACKEND:-}" ] && [ -n "${NEZHA_BACKEND:-}" ]; then
  NEZHA_GRPC_BACKEND=$(printf '%s' "${NEZHA_BACKEND}" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##')
  export NEZHA_GRPC_BACKEND
fi

exec /docker-entrypoint.sh "$@"
