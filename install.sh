#!/usr/bin/env bash
# =============================================================================
# Nezha Aurora —— Linux 一键安装脚本
#
# 项目: https://github.com/guanxi660-crypto/nezha-aurora
# 镜像: ghcr.io/guanxi660-crypto/nezha-aurora（内置 Nginx 反代，单容器即用）
#
# 用法:
#   bash install.sh                                    # 交互式安装
#   bash install.sh -y --backend http://127.0.0.1:8008 --port 8080
#   bash install.sh update                             # 拉最新镜像并重建（保留配置）
#   bash install.sh status                             # 查看运行状态
#   bash install.sh uninstall [--purge]                # 移除容器（--purge 连镜像一起删）
#
# 远程一键（复制即用）:
#   bash <(curl -fsSL https://raw.githubusercontent.com/guanxi660-crypto/nezha-aurora/main/install.sh)
#
# 选项:
#   --backend URL        哪吒面板地址（含协议），默认 http://host.docker.internal:8008
#   --port N             宿主机监听端口，默认 8080
#   --name NAME          容器名，默认 nezha-aurora
#   --image REF          自定义镜像（镜像站/自建），默认官方 GHCR 镜像
#   --grpc-backend H:P   Agent 上报通道（不含协议），默认由容器内自动推导
#   --build              不拉官方镜像，改用源码本地构建（非 amd64 架构需要）
#   --mirror NAME        安装 Docker 时使用镜像源（如 Aliyun，中国大陆网络适用）
#   -y, --yes            跳过所有交互确认，直接使用默认值/给定参数
#   -h, --help           显示帮助
#
# 环境变量等价物: NEZHA_BACKEND / NEZHA_GRPC_BACKEND / AURORA_PORT / AURORA_NAME / AURORA_IMAGE
# =============================================================================
set -euo pipefail

IMAGE_DEFAULT="ghcr.io/guanxi660-crypto/nezha-aurora:latest"
REPO_URL="https://github.com/guanxi660-crypto/nezha-aurora.git"

# ---------------------------- 输出工具 ----------------------------
if [ -t 1 ]; then
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_RESET=$'\033[0m'
else
  C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_RESET=''
fi
info() { printf '%s[INFO]%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s[ OK ]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%s[FAIL]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]:-/dev/null}" 2>/dev/null | sed 's/^# \{0,1\}//' || true
  cat <<'EOF'

用法: bash install.sh [install|update|status|uninstall] [选项]
  install    （默认）安装并启动 Aurora
  update     拉取最新镜像并重建容器，保留现有面板地址与端口
  status     查看容器与后端连通状态
  uninstall  移除容器；加 --purge 同时删除镜像
选项见脚本头部注释（--backend / --port / --name / --image / --build / --mirror / -y）。
EOF
}

# ---------------------------- 参数解析 ----------------------------
CMD="install"
BACKEND="${NEZHA_BACKEND:-}"
GRPC_BACKEND="${NEZHA_GRPC_BACKEND:-}"
PORT="${AURORA_PORT:-8080}"
NAME="${AURORA_NAME:-nezha-aurora}"
IMAGE="${AURORA_IMAGE:-$IMAGE_DEFAULT}"
BUILD=0
PURGE=0
ASSUME_YES=0
DOCKER_MIRROR=""
BACKEND_SET=0
PORT_SET=0
BUILD_TMP=""

cleanup() {
  if [ -n "$BUILD_TMP" ] && [ -d "$BUILD_TMP" ]; then
    rm -rf "$BUILD_TMP"
  fi
}
trap cleanup EXIT

ORIG_ARGS=("$@")
while [ $# -gt 0 ]; do
  case "$1" in
    install|update|status|uninstall) CMD="$1" ;;
    --backend)      [ $# -ge 2 ] || die "--backend 需要一个值"; BACKEND="$2"; BACKEND_SET=1; shift ;;
    --grpc-backend) [ $# -ge 2 ] || die "--grpc-backend 需要一个值"; GRPC_BACKEND="$2"; shift ;;
    --port)         [ $# -ge 2 ] || die "--port 需要一个值"; PORT="$2"; PORT_SET=1; shift ;;
    --name)         [ $# -ge 2 ] || die "--name 需要一个值"; NAME="$2"; shift ;;
    --image)        [ $# -ge 2 ] || die "--image 需要一个值"; IMAGE="$2"; shift ;;
    --mirror)       [ $# -ge 2 ] || die "--mirror 需要一个值"; DOCKER_MIRROR="$2"; shift ;;
    --build)        BUILD=1 ;;
    --purge)        PURGE=1 ;;
    -y|--yes)       ASSUME_YES=1 ;;
    -h|--help)      usage; exit 0 ;;
    *)              die "未知参数: $1（--help 查看用法）" ;;
  esac
  shift
done

# ---------------------------- 基础检查 ----------------------------
[ "$(uname -s)" = "Linux" ] || die "本脚本仅支持 Linux（当前: $(uname -s)）"

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1 && [ -f "$0" ] && [ -r "$0" ]; then
    info "需要 root 权限，尝试通过 sudo 重新执行…"
    if [ ${#ORIG_ARGS[@]} -gt 0 ]; then
      exec sudo bash "$0" "${ORIG_ARGS[@]}"
    else
      exec sudo bash "$0"
    fi
  fi
  die "请以 root 运行（或在命令前加 sudo；远程一键请用 sudo bash <(curl ...)）"
fi


# 交互读取：兼容 curl|bash（stdin 非 tty 时改读 /dev/tty，都没有则用默认值）
ask() { # ask <提示> <默认值> -> stdout
  local prompt="$1" default="$2" answer=""
  if [ "$ASSUME_YES" -eq 1 ]; then
    printf '%s' "$default"
    return 0
  fi
  if [ -t 0 ]; then
    read -r -p "$prompt [${default}]: " answer || true
  elif [ -e /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
    read -r -p "$prompt [${default}]: " answer < /dev/tty || true
  fi
  printf '%s' "${answer:-$default}"
}

confirm() { # confirm <提示> -> 0=同意
  local answer
  if [ "$ASSUME_YES" -eq 1 ]; then
    return 0
  fi
  answer=$(ask "$1 (y/N)" "n")
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

pkg_install() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "$@"
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$@"
  else
    return 1
  fi
}

ensure_curl() {
  if ! command -v curl >/dev/null 2>&1; then
    info "安装 curl…"
    pkg_install curl || die "curl 缺失且自动安装失败，请手动安装后重试"
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    ensure_curl
    info "未检测到 Docker，使用官方脚本安装（get.docker.com）…"
    local installer
    installer=$(mktemp)
    curl -fsSL https://get.docker.com -o "$installer" || die "下载 Docker 安装脚本失败（网络问题可先手动安装 Docker）"
    if [ -n "$DOCKER_MIRROR" ]; then
      sh "$installer" --mirror "$DOCKER_MIRROR" || die "Docker 安装失败"
    else
      sh "$installer" || die "Docker 安装失败（中国大陆网络可加 --mirror Aliyun 重试）"
    fi
    rm -f "$installer"
  fi
  if ! docker info >/dev/null 2>&1; then
    if command -v systemctl >/dev/null 2>&1; then
      systemctl start docker >/dev/null 2>&1 || true
    fi
    if ! docker info >/dev/null 2>&1 && command -v service >/dev/null 2>&1; then
      service docker start >/dev/null 2>&1 || true
    fi
  fi
  docker info >/dev/null 2>&1 || die "Docker 守护进程未运行，请先启动 Docker（systemctl start docker）后重试"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable docker >/dev/null 2>&1 || true
  fi
}

check_arch() {
  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) return 0 ;;
  esac
  if [ "$BUILD" -eq 0 ] && [ "$IMAGE" = "$IMAGE_DEFAULT" ]; then
    die "官方预构建镜像仅支持 linux/amd64（当前架构: $arch）。请加 --build 从源码本地构建，或用 --image 指定适配架构的镜像。"
  fi
  warn "当前架构 $arch 非 amd64，将使用本地构建/自定义镜像: $IMAGE"
}

# ---------------------------- 镜像获取 ----------------------------
build_image() {
  command -v git >/dev/null 2>&1 || pkg_install git || die "git 缺失且自动安装失败"
  local src script_dir
  script_dir=""
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  fi
  if [ -n "$script_dir" ] && [ -f "$script_dir/Dockerfile" ]; then
    src="$script_dir"
    info "使用本地源码构建: $src"
  else
    BUILD_TMP=$(mktemp -d)
    src="$BUILD_TMP"
    info "浅克隆源码到临时目录…"
    git clone --depth 1 "$REPO_URL" "$src" || die "克隆仓库失败（网络问题可手动下载源码后在仓库目录内运行 --build）"
  fi
  IMAGE="nezha-aurora:local"
  info "构建镜像 $IMAGE（首次需要拉取 node/nginx 基础镜像，耗时较长）…"
  docker build -t "$IMAGE" "$src" || die "镜像构建失败，请检查上方日志"
}

fetch_image() {
  if [ "$BUILD" -eq 1 ]; then
    build_image
    return 0
  fi
  info "拉取镜像 $IMAGE …"
  local pull_out
  if pull_out=$(docker pull "$IMAGE" 2>&1); then
    printf '%s\n' "$pull_out" | tail -n 2
    return 0
  fi
  printf '%s\n' "$pull_out" >&2
  case "$pull_out" in
    *denied*|*unauthorized*|*authentication*)
      warn "镜像拉取被拒绝：GHCR 包可能是私有的。两种解决办法："
      warn "  1) GitHub 仓库 → Packages → nezha-aurora → Package settings → 可见性改为 Public"
      warn "  2) docker login ghcr.io -u <GitHub用户名>（密码填有 read:packages 权限的 PAT），再重跑本脚本"
      ;;
    *)
      warn "拉取失败。若是网络问题（中国大陆访问 ghcr.io 常见），可以："
      warn "  - 用 --image <镜像地址> 指定可用的镜像源"
      warn "  - 用 --build 从源码本地构建"
      ;;
  esac
  die "镜像拉取失败"
}

# ---------------------------- 容器操作 ----------------------------
container_exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$NAME"
}

read_existing_config() {
  local envs old
  envs=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME")
  if [ "$BACKEND_SET" -eq 0 ]; then
    old=$(printf '%s\n' "$envs" | sed -n 's/^NEZHA_BACKEND=//p' | head -n 1)
    if [ -n "$old" ]; then BACKEND="$old"; fi
  fi
  if [ -z "$GRPC_BACKEND" ]; then
    GRPC_BACKEND=$(printf '%s\n' "$envs" | sed -n 's/^NEZHA_GRPC_BACKEND=//p' | head -n 1)
  fi
  if [ "$PORT_SET" -eq 0 ]; then
    old=$(docker port "$NAME" 80/tcp 2>/dev/null | head -n 1 | awk -F: '{print $NF}')
    if [ -n "$old" ]; then PORT="$old"; fi
  fi
}

normalize_backend() {
  BACKEND="${BACKEND%/}"
  case "$BACKEND" in
    http://*|https://*) : ;;
    *) die "面板地址必须含协议，例如 http://127.0.0.1:8008 或 https://status.example.com（当前: $BACKEND）" ;;
  esac
  local hostpart
  hostpart=$(printf '%s' "$BACKEND" | sed -E 's#^https?://##; s#[:/].*$##')
  if [ "$hostpart" = "127.0.0.1" ] || [ "$hostpart" = "localhost" ]; then
    BACKEND=$(printf '%s' "$BACKEND" | sed -E 's#^(https?://)(127\.0\.0\.1|localhost)#\1host.docker.internal#')
    warn "面板在本机：容器内 127.0.0.1 指向容器自身，已自动改写为 $BACKEND"
  fi
}

validate_port() {
  case "$PORT" in
    ''|*[!0-9]*) die "端口必须是数字（当前: $PORT）" ;;
  esac
  if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    die "端口超出范围 1-65535（当前: $PORT）"
  fi
}

port_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk -v p=":$PORT" '$4 ~ p"$" { found = 1 } END { exit !found }'
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk -v p=":$PORT" '$4 ~ p"$" { found = 1 } END { exit !found }'
  else
    return 1
  fi
}

run_container() {
  local args=(run -d --name "$NAME" --restart unless-stopped
    -p "${PORT}:80"
    --add-host=host.docker.internal:host-gateway
    -e "NEZHA_BACKEND=${BACKEND}")
  if [ -n "$GRPC_BACKEND" ]; then
    args+=(-e "NEZHA_GRPC_BACKEND=${GRPC_BACKEND}")
  fi
  docker "${args[@]}" "$IMAGE" >/dev/null || die "容器启动失败（docker run 报错见上方；--add-host host-gateway 需要 Docker 20.10+）"
}

health_check() {
  info "等待服务就绪…"
  local i up=0 code
  for ((i = 1; i <= 30; i++)); do
    if curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
      up=1
      break
    fi
    sleep 1
  done
  if [ "$up" -eq 1 ]; then
    ok "前端页面正常（HTTP 200）"
  else
    docker logs --tail 20 "$NAME" >&2 || true
    die "前端 30 秒内未就绪，请检查上方容器日志"
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${PORT}/api/v1/setting" 2>/dev/null || true)
  if [ "$code" = "200" ]; then
    ok "面板反代正常（/api/v1/setting → 200）"
  else
    warn "面板反代检查返回 ${code:-无响应}：请确认面板地址 ${BACKEND} 从本机可达，"
    warn "且面板未开启 force_auth（强制登录会挡住匿名访客）。前端本身已就绪。"
  fi
}

firewall_hint() {
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    warn "检测到 firewalld 运行中，若外网无法访问请放行端口："
    warn "  firewall-cmd --permanent --add-port=${PORT}/tcp && firewall-cmd --reload"
  elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
    warn "检测到 ufw 运行中，若外网无法访问请放行端口：ufw allow ${PORT}/tcp"
  fi
}

summary() { # summary <动作>
  local ip
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$ip" ]; then ip="<服务器IP>"; fi
  printf '\n'
  info "=================================================="
  info " Nezha Aurora $1完成"
  info " 访问地址:   http://${ip}:${PORT}"
  info " 面板后端:   ${BACKEND}"
  info " 容器名:     ${NAME}"
  info " 镜像:       ${IMAGE}"
  info "--------------------------------------------------"
  info " 查看日志:   docker logs -f ${NAME}"
  info " 重启:       docker restart ${NAME}"
  info " 更新:       bash install.sh update"
  info " 卸载:       bash install.sh uninstall"
  info "=================================================="
  firewall_hint
}

# ---------------------------- 子命令 ----------------------------
cmd_install() {
  ensure_docker
  ensure_curl
  check_arch
  if container_exists; then
    read_existing_config
    info "检测到已有容器 ${NAME}，将沿用其配置重建（面板地址/端口可用参数覆盖）"
  fi
  if [ "$BACKEND_SET" -eq 0 ]; then
    BACKEND=$(ask "哪吒面板地址（含协议）" "${BACKEND:-http://host.docker.internal:8008}")
  fi
  normalize_backend
  if [ "$PORT_SET" -eq 0 ]; then
    PORT=$(ask "宿主机监听端口" "$PORT")
  fi
  validate_port
  fetch_image
  if container_exists; then
    confirm "容器 ${NAME} 已存在，删除并重建？" || die "已取消"
    docker rm -f "$NAME" >/dev/null
  fi
  if port_busy; then
    die "端口 ${PORT} 已被其他程序占用，请用 --port 换一个端口"
  fi
  run_container
  health_check
  summary "安装"
}

cmd_update() {
  container_exists || die "未找到容器 ${NAME}，请先运行 install"
  read_existing_config
  [ -n "$BACKEND" ] || die "无法从现有容器读取 NEZHA_BACKEND，请用 install --backend <地址> 重新安装"
  ensure_docker
  ensure_curl
  check_arch
  normalize_backend
  validate_port
  fetch_image
  docker rm -f "$NAME" >/dev/null
  run_container
  health_check
  summary "更新"
}

cmd_status() {
  ensure_curl
  container_exists || die "容器 ${NAME} 不存在"
  docker ps -a --filter "name=^${NAME}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  local envs backend port code
  envs=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME")
  backend=$(printf '%s\n' "$envs" | sed -n 's/^NEZHA_BACKEND=//p' | head -n 1)
  port=$(docker port "$NAME" 80/tcp 2>/dev/null | head -n 1 | awk -F: '{print $NF}')
  info "面板后端: ${backend:-未知}"
  if [ -n "$port" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null || true)
    info "前端检查: http://127.0.0.1:${port}/ → ${code:-无响应}"
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/api/v1/setting" 2>/dev/null || true)
    info "面板反代: /api/v1/setting → ${code:-无响应}"
  fi
}

cmd_uninstall() {
  local used_image="$IMAGE"
  if container_exists; then
    used_image=$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || printf '%s' "$IMAGE")
    docker rm -f "$NAME" >/dev/null
    ok "容器 ${NAME} 已移除"
  else
    warn "容器 ${NAME} 不存在，跳过"
  fi
  if [ "$PURGE" -eq 1 ]; then
    if docker rmi "$used_image" >/dev/null 2>&1; then
      ok "镜像 ${used_image} 已删除"
    else
      warn "镜像 ${used_image} 删除失败（可能正被其他容器使用，或已不存在）"
    fi
  fi
}

case "$CMD" in
  install)   cmd_install ;;
  update)    cmd_update ;;
  status)    cmd_status ;;
  uninstall) cmd_uninstall ;;
esac