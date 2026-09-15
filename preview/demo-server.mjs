/**
 * Aurora 本地演示服务（零依赖）
 *
 * 用途：在没有哪吒面板、或面板暂时不可达时预览主题完整效果。
 * 它会托管 ../dist 静态文件，并用内置模拟数据实现哪吒 V2 的只读 API 与实时 WebSocket。
 *
 * 用法：
 *   npm run build
 *   node preview/demo-server.mjs            # 默认 http://127.0.0.1:8080
 *   node preview/demo-server.mjs 9000       # 指定端口
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2]) || 8080;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, "..", "dist");
const NOW = Date.now();
const PUSH_INTERVAL = 2000;

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("缺少 dist/index.html，请先执行 npm run build");
  process.exit(1);
}

/* ------------------------------ 模拟节点 ------------------------------ */

const NODES = [
  {
    id: 1,
    name: "HK-01 · 香港三网",
    cc: "HK",
    platform: "ubuntu",
    platformVersion: "22.04",
    arch: "amd64",
    cpu: ["AMD EPYC 7B13 8-Core Processor", "AMD EPYC 7B13 8-Core Processor"],
    cores: 8,
    mem: 4 * 1024 ** 3,
    disk: 60 * 1024 ** 3,
    swap: 2 * 1024 ** 3,
    online: true,
    base: { cpu: 24, mem: 0.62, disk: 0.41, up: 1.6e6, down: 8.4e6, transfer: 1.2e12 },
    note: JSON.stringify({
      planDataMod: { bandwidth: "500 Mbps", trafficVol: "1 TB", networkRoute: "CN2 GIA", IPv4: "1" },
      billingDataMod: { amount: "￥299/年", endDate: "2027-03-18", cycle: "年" },
    }),
  },
  {
    id: 2,
    name: "JP-02 · 东京 Lite",
    cc: "JP",
    platform: "debian",
    platformVersion: "12",
    arch: "arm64",
    cpu: ["Ampere Altra Q80-30"],
    cores: 4,
    mem: 2 * 1024 ** 3,
    disk: 40 * 1024 ** 3,
    swap: 1024 ** 3,
    online: true,
    base: { cpu: 61, mem: 0.78, disk: 0.66, up: 3.2e6, down: 5.1e6, transfer: 4.4e11 },
    note: "",
  },
  {
    id: 3,
    name: "SG-03 · 新加坡",
    cc: "SG",
    platform: "alpine",
    platformVersion: "3.20",
    arch: "amd64",
    cpu: ["Intel Xeon Platinum 8375C"],
    cores: 2,
    mem: 1024 ** 3,
    disk: 20 * 1024 ** 3,
    swap: 512 * 1024 ** 2,
    online: true,
    base: { cpu: 88, mem: 0.91, disk: 0.83, up: 9.4e5, down: 2.2e6, transfer: 8.1e11 },
    note: "",
  },
  {
    id: 4,
    name: "US-04 · 洛杉矶",
    cc: "US",
    platform: "centos",
    platformVersion: "9",
    arch: "amd64",
    cpu: ["AMD Ryzen 9 7950X 16-Core"],
    cores: 16,
    gpu: ["NVIDIA RTX 4090"],
    mem: 32 * 1024 ** 3,
    disk: 500 * 1024 ** 3,
    swap: 8 * 1024 ** 3,
    online: true,
    base: { cpu: 12, mem: 0.35, disk: 0.28, up: 1.1e7, down: 2.6e7, transfer: 6.9e12 },
    note: "",
  },
  {
    id: 5,
    name: "DE-05 · 法兰克福",
    cc: "DE",
    platform: "windows",
    platformVersion: "Server 2022",
    arch: "amd64",
    cpu: ["Intel Xeon E5-2680 v4"],
    cores: 8,
    mem: 8 * 1024 ** 3,
    disk: 120 * 1024 ** 3,
    swap: 0,
    online: false,
    base: { cpu: 0, mem: 0, disk: 0.34, up: 0, down: 0, transfer: 2.2e12 },
    note: "",
  },
];

const jitter = (value, ratio = 0.18) => Math.max(0, value * (1 + (Math.random() - 0.5) * ratio));

function buildServer(node, tick) {
  const online = node.online;
  const cpu = online ? Math.min(99, jitter(node.base.cpu)) : 0;

  return {
    id: node.id,
    name: node.name,
    public_note: node.note,
    last_active: online
      ? new Date(NOW + tick * PUSH_INTERVAL).toISOString()
      : new Date(NOW - 86400 * 1000).toISOString(),
    country_code: node.cc,
    host: {
      platform: node.platform,
      platform_version: node.platformVersion,
      cpu: node.cpu,
      gpu: node.gpu || [],
      mem_total: node.mem,
      disk_total: node.disk,
      swap_total: node.swap,
      arch: node.arch,
      boot_time: Math.floor(NOW / 1000) - 86400 * (3 + node.id),
      version: "v1.4.2",
      virtualization: "kvm",
    },
    state: {
      cpu,
      mem_used: online ? jitter(node.base.mem) * node.mem : 0,
      swap_used: online ? jitter(0.12) * node.swap : 0,
      disk_used: jitter(node.base.disk) * node.disk,
      net_in_transfer: node.base.transfer * 0.7,
      net_out_transfer: node.base.transfer * 0.3,
      net_in_speed: online ? jitter(node.base.down) : 0,
      net_out_speed: online ? jitter(node.base.up) : 0,
      uptime: online ? 86400 * (3 + node.id) + 3600 * 5 : 0,
      load_1: online ? jitter((node.cores || 4) * 0.4, 0.6) : 0,
      load_5: online ? jitter((node.cores || 4) * 0.35, 0.6) : 0,
      load_15: online ? jitter((node.cores || 4) * 0.3, 0.6) : 0,
      tcp_conn_count: online ? Math.round(jitter(240)) : 0,
      udp_conn_count: online ? Math.round(jitter(48)) : 0,
      process_count: online ? Math.round(jitter(180)) : 0,
      temperatures: online ? [{ Name: "cpu", Temperature: Number(jitter(46).toFixed(1)) }] : null,
      gpu: node.gpu ? [jitter(38)] : null,
      gpus: node.gpu ? [{ utilization: jitter(38), memory_used: 6e9, memory_total: 24e9 }] : undefined,
    },
  };
}

/* ------------------------------ 历史曲线 ------------------------------ */

const METRIC_SHAPES = {
  cpu: { base: 30, wave: 12, noise: 6 },
  memory: { base: 62, wave: 6, noise: 3 },
  swap: { base: 8, wave: 3, noise: 1.5 },
  disk: { base: 41, wave: 0.6, noise: 0.2 },
  net_in_speed: { base: 8e6, wave: 4e6, noise: 1.6e6 },
  net_out_speed: { base: 2.2e6, wave: 1.2e6, noise: 5e5 },
  net_in_transfer: { base: 3.4e11, wave: 0, noise: 0, trend: 9e8 },
  net_out_transfer: { base: 1.1e11, wave: 0, noise: 0, trend: 3e8 },
  load1: { base: 1.4, wave: 0.9, noise: 0.3 },
  load5: { base: 1.3, wave: 0.7, noise: 0.25 },
  load15: { base: 1.2, wave: 0.5, noise: 0.2 },
  tcp_conn: { base: 210, wave: 60, noise: 30 },
  udp_conn: { base: 40, wave: 12, noise: 8 },
  process_count: { base: 172, wave: 8, noise: 5 },
  temperature: { base: 46, wave: 5, noise: 2 },
  gpu: { base: 36, wave: 18, noise: 6 },
  uptime: { base: 400000, wave: 0, noise: 0, trend: 300 },
};

function metricSeries(metric) {
  const shape = METRIC_SHAPES[metric] || METRIC_SHAPES.cpu;
  const count = 288;
  const step = 5 * 60 * 1000;
  const start = NOW - count * step;
  const points = [];

  for (let i = 0; i < count; i++) {
    const value =
      shape.base +
      Math.sin(i / 14) * shape.wave +
      Math.sin(i / 3.3) * shape.wave * 0.3 +
      (Math.random() - 0.5) * shape.noise +
      (shape.trend || 0) * i;
    points.push({ ts: start + i * step, value: Math.max(0, Number(value.toFixed(3))) });
  }
  return points;
}

/* ------------------------------ 服务 / 流量 ------------------------------ */

const SERVICES = {
  "1": { service_name: "百度", current_up: 1, current_down: 0, total_up: 2864, total_down: 3, delay: [42, 45, 40, 43, 41, 44], up: [], down: [] },
  "2": { service_name: "Google", current_up: 1, current_down: 0, total_up: 2870, total_down: 0, delay: [12, 13, 11, 12, 14, 12], up: [], down: [] },
  "3": { service_name: "自建 API", current_up: 0, current_down: 1, total_up: 1204, total_down: 88, delay: [0, 0, 0, 0, 0, 0], up: [], down: [] },
  "4": { service_name: "GitHub", current_up: 1, current_down: 0, total_up: 2830, total_down: 12, delay: [88, 92, 85, 90, 87, 91], up: [], down: [] },
  "5": { service_name: "Cloudflare", current_up: 1, current_down: 0, total_up: 2876, total_down: 1, delay: [7, 8, 6, 7, 9, 7], up: [], down: [] },
};

const CYCLE_TRANSFER = {
  "1": {
    name: "月流量",
    from: "2026-09-01 00:00:00",
    to: "2026-10-01 00:00:00",
    max: { "1": 1e12, "2": 5e11, "3": 2e11, "4": 2e12 },
    min: { "1": 0, "2": 0, "3": 0, "4": 0 },
    server_name: { "1": "HK-01 · 香港三网", "2": "JP-02 · 东京 Lite", "3": "SG-03 · 新加坡", "4": "US-04 · 洛杉矶" },
    transfer: { "1": 6.2e11, "2": 4.1e11, "3": 1.86e11, "4": 3.1e11 },
    next_update: { "1": "2026-10-01", "2": "2026-10-01", "3": "2026-10-01", "4": "2026-10-01" },
  },
};

const MONITORS = [
  { monitor_id: 1, monitor_name: "Google", server_id: 1, server_name: "HK-01 · 香港三网", created_at: [], avg_delay: [12, 13, 11, 14, 12, 13, 12, 15, 13, 12], packet_loss: [0, 0, 0, 0.01, 0, 0, 0, 0, 0, 0] },
  { monitor_id: 2, monitor_name: "Cloudflare", server_id: 1, server_name: "HK-01 · 香港三网", created_at: [], avg_delay: [4, 5, 4, 4, 6, 5, 4, 5, 4, 4], packet_loss: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { monitor_id: 1, monitor_name: "Google", server_id: 2, server_name: "JP-02 · 东京 Lite", created_at: [], avg_delay: [31, 34, 29, 41, 33, 30, 35, 32, 38, 30], packet_loss: [0, 0.02, 0, 0, 0.01, 0, 0, 0, 0, 0] },
  { monitor_id: 1, monitor_name: "Google", server_id: 4, server_name: "US-04 · 洛杉矶", created_at: [], avg_delay: [142, 148, 139, 151, 145, 143, 149, 141, 146, 144], packet_loss: [0, 0, 0.01, 0, 0, 0, 0, 0, 0, 0] },
];

/* ------------------------------ HTTP 服务 ------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const sendJson = (res, payload) => {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const wssClients = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/api/v1/setting") {
    return sendJson(res, {
      success: true,
      data: {
        config: {
          debug: false,
          language: "zh_CN",
          site_name: "Aurora 演示站",
          user_template: "aurora-dist",
          admin_template: "admin-dist",
          custom_code:
            "<script>window.CustomDesc='演示数据 · Aurora Theme';window.AuroraConfig={accentColor:'#38bdf8',showAdmin:true}</script>",
        },
        version: "v2.3.12",
        tsdb_enabled: true,
      },
    });
  }

  if (pathname === "/api/v1/server-group") {
    return sendJson(res, {
      success: true,
      data: [
        { group: { id: 1, name: "亚太", created_at: "", updated_at: "" }, servers: [1, 2, 3] },
        { group: { id: 2, name: "欧美", created_at: "", updated_at: "" }, servers: [4, 5] },
      ],
    });
  }

  if (pathname === "/api/v1/service") {
    return sendJson(res, {
      success: true,
      data: { services: SERVICES, cycle_transfer_stats: CYCLE_TRANSFER },
    });
  }

  const metricsMatch = pathname.match(/^\/api\/v1\/server\/(\d+)\/metrics$/);
  if (metricsMatch) {
    const id = Number(metricsMatch[1]);
    const metric = url.searchParams.get("metric") || "cpu";
    const node = NODES.find((item) => item.id === id);
    return sendJson(res, {
      success: true,
      data: {
        server_id: id,
        server_name: node?.name || "",
        metric,
        data_points: metricSeries(metric),
      },
    });
  }

  const monitorMatch = pathname.match(/^\/api\/v1\/server\/(\d+)\/service$/);
  if (monitorMatch) {
    const id = Number(monitorMatch[1]);
    return sendJson(res, {
      success: true,
      data: MONITORS.filter((item) => item.server_id === id),
    });
  }

  if (pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not found" }));
  }

  let filePath = path.join(DIST, pathname);
  if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

/* --------------------- 极简 WebSocket 服务端（发送文本帧） --------------------- */

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function encodeTextFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/api/v1/ws/server") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  let tick = 0;
  const push = () => {
    tick += 1;
    const servers = NODES.map((node) => buildServer(node, tick));
    try {
      socket.write(
        encodeTextFrame(
          JSON.stringify({
            now: NOW + tick * PUSH_INTERVAL,
            online: servers.filter((item) => item.last_active > new Date(NOW - 60000).toISOString()).length,
            servers,
          }),
        ),
      );
    } catch {
      /* 连接已断开 */
    }
  };

  push();
  const timer = setInterval(push, PUSH_INTERVAL);
  wssClients.add(socket);

  const cleanup = () => {
    clearInterval(timer);
    wssClients.delete(socket);
  };

  socket.on("close", cleanup);
  socket.on("error", cleanup);
  socket.on("data", () => {
    /* 忽略客户端帧（本演示不需要处理） */
  });
});

server.listen(PORT, () => {
  console.log(`Aurora 演示服务已启动：http://127.0.0.1:${PORT}`);
  console.log("按 Ctrl+C 停止");
});
