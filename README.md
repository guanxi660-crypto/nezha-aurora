# Nezha Aurora

为 **哪吒监控 V2** 打造的现代用户前端主题，视觉风格参考 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor)：
卡片式节点总览、语义化进度条、实时网速、环形用量、历史曲线、服务监控与周期流量，深/浅双主题、移动端自适应。

项目直接消费哪吒 V2 官方用户前端 API，**不修改后端、不需要面板账号密码**，一套静态文件即可挂到现有面板上。

![主页](screenshots/preview-home-dark.png)

---

## 功能

| 模块 | 说明 |
| --- | --- |
| 节点总览 | 在线/离线统计、实时上下行速率、总流量、最长运行时长 |
| 节点卡片 | 系统图标 + 地区旗帜、CPU/内存/磁盘进度条、上下行实时速率、负载、连接数、进程、温度、累计流量 |
| 筛选与排序 | 在线状态过滤、关键字搜索、7 种排序维度（含升降序） |
| 世界地图 | 按 `country_code` 投影打点，同地区聚合计数、在线脉冲动画、悬浮查看该地区节点并点击进入详情 |
| 节点详情 | 四环用量总览、CPU/内存/交换/磁盘/网络速率/流量/负载/连接/进程/温度/GPU 历史曲线（1d / 7d / 30d） |
| 实时性 | WebSocket 推送（`/api/v1/ws/server`），断线自动重连（指数退避） |
| 外观 | 深/浅色主题持久化、面板自定义代码注入、Logo/背景图/描述/外链、强调色可配置、右上角管理面板入口 |
| 兼容 | 后端 V2 新老字段全容错；移动端卡片单列布局；地图数据按需懒加载 |

---

## 后端接口

主题只使用哪吒 V2 公开的只读接口（与官方用户前端完全一致）：

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/setting` | 站点名称、语言、`custom_code`、TSDB 开关（`version` 仅对管理员返回） |
| `GET /api/v1/server-group` | 分组与节点归属 |
| `GET /api/v1/server/:id/metrics?metric=&period=` | 历史指标曲线 |
| `GET /api/v1/server/:id/service?period=` | 单节点服务监控延迟 |
| `WS /api/v1/ws/server` | 实时状态推送 `{ now, online, servers[] }` |

> 如果面板开启了 `force_auth`（强制登录），匿名访客将无法读取数据；此时需要在反代层为 `/api/v1` 放行或关闭该选项。

---

## 本地开发

```bash
npm install
npm run dev
```

默认把 `/api/v1` 与 WebSocket 代理到 `http://127.0.0.1:8008`。连接远端面板时在项目根目录新建 `.env.local`：

```dotenv
VITE_API_TARGET=https://status.example.com
VITE_WS_TARGET=wss://status.example.com
# 自签证书时启用
# VITE_API_INSECURE=1
```

### 无面板预览（内置演示数据）

想先看效果、或面板暂时不可达时，可以启动自带的演示服务（零依赖，内置模拟节点与实时推送）：

```bash
npm run build
npm run preview:demo        # 打开 http://127.0.0.1:8080
```

演示服务会托管 `dist/` 并用模拟数据实现 `/api/v1/*` 与 WebSocket，端口可通过 `node preview/demo-server.mjs 9000` 指定。

---

## 构建

```bash
npm run build          # 产物在 dist/
npm run build:theme    # 额外生成 dist.zip（哪吒主题发布包）
```

---

## 部署：Docker（最简，推荐）

镜像由 GitHub Actions 在线构建后推送到 GHCR，**直接拉取即可**，服务器上不需要 Node 环境。
容器内已内置 Nginx 反代（`/api/v1`、WebSocket、`/dashboard`），所以**单容器就能跑通**，不必再单独写反代配置。

### 1. 拉取并启动

```bash
docker run -d \
  --name nezha-aurora \
  --restart unless-stopped \
  -p 8080:80 \
  -e NEZHA_BACKEND=https://your-panel.example.com \
  ghcr.io/guanxi660-crypto/nezha-aurora:latest
```

打开 `http://<服务器IP>:8080` 即可。

> 仓库的 Package 默认可能是私有的，首次使用请到 GitHub 仓库 → 右侧 **Packages** → `nezha-aurora` → **Package settings** 把可见性改为 **Public**。
> 若想保持私有，就先 `echo <你的PAT> | docker login ghcr.io -u <用户名> --password-stdin` 再拉取。

### 2. 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NEZHA_BACKEND` | 哪吒面板地址（含协议）。作为 `/api/v1`、WebSocket、`/dashboard` 的反代目标 | `http://host.docker.internal:8008` |
| `NEZHA_GRPC_BACKEND` | Agent 上报通道（gRPC）目标，**不含协议**。未设置时自动从 `NEZHA_BACKEND` 推导 | 由上一项推导 |

按面板位置选择写法：

- 面板跑在**宿主机**上：`-e NEZHA_BACKEND=http://host.docker.internal:8008`，Linux 需追加 `--add-host=host.docker.internal:host-gateway`
- 面板是**另一个容器**：`-e NEZHA_BACKEND=http://nezha:8008`，并确保两者在同一 Docker 网络
- 面板在**其它服务器**：`-e NEZHA_BACKEND=https://panel.example.com`

### 3. docker compose

```yaml
services:
  aurora:
    image: ghcr.io/guanxi660-crypto/nezha-aurora:latest
    container_name: nezha-aurora
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      NEZHA_BACKEND: http://host.docker.internal:8008
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### 4. 本地构建镜像

```bash
npm run docker:build     # 等价于 docker build -t nezha-aurora .
npm run docker:run       # 起一个连宿主机面板的本地容器
```

或者完全手动：

```bash
docker build -t nezha-aurora .
docker run -d --name nezha-aurora -p 8080:80 \
  -e NEZHA_BACKEND=https://status.example.com \
  nezha-aurora
```

> 想上 HTTPS，用宿主机的 Nginx / Caddy 再反代到本容器的 `80` 端口即可。
> 若希望本容器直接接管整个域名（含 Agent 上报），模板里已预留 `/proto.NezhaService/` 的 gRPC 转发段。

---

## 部署方式一：静态前端 + 反向代理

前端请求同源的 `/api/`，因此必须由 Nginx / Caddy 把 `/api/v1`、`/dashboard` 与 Agent 上报通道转发给哪吒后端。

### 1. 上传静态文件

```bash
npm run build
mkdir -p /opt/nezha/aurora
cp -r dist/* /opt/nezha/aurora/
```

### 2. 配置反向代理

- 宿主机 Nginx：参考 [`deploy/nginx-site.conf`](deploy/nginx-site.conf)
- Caddy：参考 [`deploy/Caddyfile.example`](deploy/Caddyfile.example)

两份示例都包含三段关键路由：

1. `/proto.NezhaService/` → Agent 上报（gRPC h2c），**必须保留**
2. `/dashboard` 与 `/api/v1` → 面板后台、REST API、WebSocket
3. 其余请求 → Aurora 静态文件（SPA 回退到 `index.html`）

---

## 部署方式二：编译进面板作为内置主题

> 只有在你想让 Aurora 出现在面板后台「系统设置 → 主题」的下拉框里时，才需要走这条路。
> 它要求在 **Linux** 上准备 **Go 1.21+**、**Node 18+**、**git**、**yq**，并且以后每次改前端都要重新编译 Dashboard。
> 如果只是想把 Aurora 用起来，请用上面的方式一，不需要 Go。

哪吒 V2 的用户前端是**编译期嵌入**的（`cmd/dashboard/main.go` 中的 `//go:embed *-dist`），
且 `user_template` 只接受 `service/singleton/frontend-templates.yaml` 里登记过的 `path`，所以必须重新编译 Dashboard。

下面的命令在 Linux（bash）中执行，假设 Aurora 源码位于 `/path/to/nezha-aurora`（可 `git clone https://github.com/guanxi660-crypto/nezha-aurora.git` 获取），哪吒源码位于 `/path/to/nezha`。

```bash
# 0) 安装 mikefarah 版 yq（fetch 脚本依赖它；注意不要用 Debian 源里那个 Python 版 yq）
sudo wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq
sudo chmod +x /usr/local/bin/yq

# 1) 克隆哪吒源码，并拉取官方内置主题（user-dist / admin-dist 等）
git clone https://github.com/nezhahq/nezha.git
cd nezha
sh script/fetch-frontends.sh

# 2) 构建 Aurora 到 cmd/dashboard/aurora-dist
#    outDir 位于项目根之外，必须显式加 --emptyOutDir，否则重复构建不会清空旧产物
cd /path/to/nezha-aurora
npm install
npx vite build --outDir "/path/to/nezha/cmd/dashboard/aurora-dist" --emptyOutDir

# 3) 登记主题：编辑 /path/to/nezha/service/singleton/frontend-templates.yaml，追加一条
#    - path: aurora-dist        # 必须与目录名完全一致，且以 -dist 结尾
#      name: Aurora
#      author: your-name
#      version: v0.1.0
#      is_admin: false          # 用户前端固定为 false

# 4) 编译 Dashboard
cd /path/to/nezha
go build -o dashboard ./cmd/dashboard
```

编译完成后启动面板，即可在「系统设置 → 主题」中选择 Aurora；想设为默认，把 `data/config.yaml` 里的 `user_template` 改成 `aurora-dist` 再重启面板。

几个容易踩的点：

- 目录名**必须以 `-dist` 结尾**，否则 `//go:embed *-dist` 匹配不到；目录名也要和 yaml 里的 `path` 一致。
- 产物中**不能出现以 `_` 或 `.` 开头的目录**（Go Embed 会直接忽略），`npm run build:theme` 会自动校验。
- `fetch-frontends.sh` 会删除并重写各主题目录，所以请**先执行它，再构建 Aurora**。
- 不要在面板源码根目录手动 `mkdir` 空的 `*-dist` 目录：空目录不会被 embed，缺乏内容时面板默认主题就是空的。

如果希望把 Aurora 做成“可下载主题”，让别的面板也能一键切换，可以发布主题包：

```bash
npm run build:theme     # 生成 dist.zip：附件名固定为 dist.zip，内部顶层目录为 dist/
```

把 `dist.zip` 作为 GitHub Release 附件，并在 `frontend-templates.yaml` 中补上 `repository` 与 `version`：
哪吒的下载脚本按 `{repository}/releases/download/{version}/dist.zip` 拉取，解压后重命名为 `path` 指定的目录名。

---

## 主题自定义配置

Aurora 会像官方前端一样读取面板后台「用户前端自定义代码」注入的变量，同时提供一组主题专属配置（写在同一个输入框里）：

```html
<script>
  // —— 官方变量（与官方前端语义一致）——
  window.CustomLogo = "https://example.com/logo.png"
  window.CustomDesc = "by Aurora"
  window.CustomBackgroundImage = "https://example.com/bg.webp"
  window.CustomMobileBackgroundImage = "https://example.com/bg-mobile.webp"
  window.CustomLinks = '[{"name":"Telegram","link":"https://t.me/xxx"}]'
  window.ForceTheme = "dark"          // 仅作为默认值，用户仍可手动切换
  window.ForceShowMap = true          // 默认打开世界地图视图
  window.ShowNetTransfer = true

  // —— Aurora 专属配置 ——
  window.AuroraConfig = {
    accentColor: "#38bdf8",   // 强调色（覆盖主题默认渐变）
    showAdmin: true,          // 头部「进入管理面板」入口，默认已开启，设为 false 可隐藏
    footerText: "My Status Page"
  }
</script>
```

> 背景图与外部字体/CDN 资源若被面板 CSP 拦截，请在面板后台把对应域名加入白名单。
> Aurora 默认引用了官方前端同款的 `fastly.jsdelivr.net` 旗帜与系统图标样式表；如需完全离线，可自行下载并改为本地引用。

### 关于站点版本与管理入口

- **站点版本**：哪吒后端在访客未登录时会丢弃 `/api/v1/setting` 响应里的 `version` 与 `frontend_templates` 字段，匿名访客拿不到版本号，因此概览区不展示版本，页脚也只在取到版本时才显示。
- **管理入口**：右上角齿轮按钮指向 `/dashboard`，需要反向代理把该路径转发给面板（示例配置已包含）。
- **浏览器标签图标**：主题使用独立文件名 `/aurora-icon.svg`，以避免与其它主题残留的 `/favicon.svg` 缓存冲突。切换主题后若图标未更新，强刷一次（Ctrl/Cmd + Shift + R）即可。

---

## 目录结构

```
src/
├── api/           哪吒 V2 接口封装与类型定义
├── components/    卡片、进度条、环形图、图表、世界地图、筛选栏等展示组件
├── directives/    v-fill-grid：网格最后一行按列自动补齐
├── store/         WebSocket 实时状态、站点设置、筛选排序状态
├── utils/         格式化、自定义代码注入、国家中心坐标、流量/时长/旗帜处理
├── views/         首页总览、节点详情
└── styles/        设计系统（CSS 变量 + 明暗主题）
deploy/            Nginx / Caddy 部署示例
docker/            Docker 镜像内的 Nginx 反代模板与启动脚本
preview/           零依赖演示服务（内置模拟数据，无需面板即可预览）
scripts/           国家坐标生成、主题包打包脚本
.github/           在线构建流水线（自动构建并推送镜像到 GHCR）
Dockerfile         单容器镜像定义（多阶段构建，内置反代）
```

---

## 常见问题

**页面一直显示“正在连接哪吒后端…”**
反向代理没有把 `/api/v1` 转发到面板，或面板开启了 `force_auth` 且访客未登录。

**图表没有数据**
历史曲线依赖 TSDB。面板未启用 TSDB 时曲线可能为空，页面会给出提示。

**node 详情页刷新后 404**
外层服务器缺少 SPA 回退规则，需要 `try_files $uri $uri/ /index.html`。

**WebSocket 一直重连**
反代缺少 `Upgrade` / `Connection` 头，或未设置 `Origin`（哪吒会做来源校验）。

---

## License

MIT
