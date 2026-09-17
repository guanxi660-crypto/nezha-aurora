#!/bin/sh
# 未显式指定 NEZHA_GRPC_BACKEND 时，从 NEZHA_BACKEND 推导（去掉协议前缀）。
#
# 该脚本位于 /docker-entrypoint.d/，按文件名排序会在
# 20-envsubst-on-templates.sh 之前执行，因此模板渲染时已经能取到推导结果。
set -e

if [ -z "${NEZHA_GRPC_BACKEND}" ] && [ -n "${NEZHA_BACKEND}" ]; then
  NEZHA_GRPC_BACKEND=$(printf '%s' "${NEZHA_BACKEND}" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##')
  export NEZHA_GRPC_BACKEND
fi
