import { computed, reactive } from "vue";
import { fetchServerGroup, fetchService, fetchSetting, wsServerUrl } from "@/api/client";
import type {
  CycleTransferData,
  NezhaServer,
  ServerGroup,
  ServiceData,
} from "@/api/types";
import { injectCustomCode, readRuntimeConfig, type AuroraRuntimeConfig } from "@/utils/inject";
import { isServerOnline } from "@/utils/format";

export type StatusFilter = "all" | "online" | "offline";
export type SortKey =
  | "default"
  | "name"
  | "cpu"
  | "mem"
  | "disk"
  | "up"
  | "down"
  | "uptime";

export interface PreparedServer {
  server: NezhaServer;
  online: boolean;
}

const MAX_RECONNECT_DELAY = 15000;

export const state = reactive({
  /* 站点信息 */
  siteName: "Nezha Aurora",
  siteDesc: "",
  siteLoaded: false,
  siteError: "" as string | null,
  version: "",
  tsdbEnabled: false,
  runtime: {
    links: [],
    forceCardInline: false,
    forceShowMap: false,
    forceShowServices: false,
  } as AuroraRuntimeConfig,

  /* 实时状态 */
  now: 0,
  servers: [] as NezhaServer[],
  /** 注意：后端 WS 的 online 字段是在线「用户」数，不是在线节点数 */
  onlineUsers: 0,
  wsConnected: false,
  receivedOnce: false,

  /* 静态数据 */
  groups: [] as ServerGroup[],
  services: {} as Record<string, ServiceData>,
  cycleTransfer: {} as Record<string, CycleTransferData>,

  /* 视图状态 */
  filter: {
    group: "all" as string,
    status: "all" as StatusFilter,
    keyword: "",
    sortKey: "default" as SortKey,
    sortAsc: false,
  },
});

let started = false;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

async function loadSite() {
  try {
    const setting = await fetchSetting();
    state.siteName = setting?.config?.site_name || "Nezha Aurora";
    state.version = setting?.version || "";
    state.tsdbEnabled = Boolean(setting?.tsdb_enabled);
    state.siteError = null;

    if (setting?.config?.language) {
      document.documentElement.lang = setting.config.language.replace("_", "-");
    }

    const customCode = setting?.config?.custom_code || "";
    if (customCode) {
      // 自定义代码里可能写入 window.CustomLogo 等变量，需先执行再读取
      await injectCustomCode(customCode);
    }
    state.runtime = readRuntimeConfig();
    state.siteDesc = state.runtime.desc || "";
  } catch (error) {
    state.siteError = error instanceof Error ? error.message : String(error);
    console.error("[Aurora] 读取站点设置失败", error);
  } finally {
    state.siteLoaded = true;
  }
}

async function loadGroups() {
  try {
    const groups = await fetchServerGroup();
    state.groups = Array.isArray(groups) ? groups : [];
  } catch (error) {
    console.error("[Aurora] 读取分组失败", error);
  }
}

export async function loadServices() {
  try {
    const data = await fetchService();
    state.services = data?.services || {};
    state.cycleTransfer = data?.cycle_transfer_stats || {};
  } catch (error) {
    console.error("[Aurora] 读取服务监控失败", error);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, delay);
}

function applyPayload(payload: { now: number; online?: number; servers?: NezhaServer[] }) {
  if (typeof payload.now === "number") state.now = payload.now;
  if (Array.isArray(payload.servers)) state.servers = payload.servers;
  if (typeof payload.online === "number") state.onlineUsers = payload.online;
  state.receivedOnce = true;
}

function connectWs() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(wsServerUrl());
  } catch (error) {
    console.error("[Aurora] WebSocket 创建失败", error);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    state.wsConnected = true;
    reconnectAttempts = 0;
  };

  socket.onmessage = (event) => {
    if (typeof event.data !== "string") return;
    try {
      applyPayload(JSON.parse(event.data));
    } catch (error) {
      console.error("[Aurora] 解析实时数据失败", error);
    }
  };

  socket.onclose = () => {
    state.wsConnected = false;
    socket = null;
    scheduleReconnect();
  };

  socket.onerror = () => {
    state.wsConnected = false;
  };
}

/** 惰性启动：多次调用只会初始化一次 */
export function initStore() {
  if (started) return;
  started = true;

  void loadSite();
  void loadGroups();

  connectWs();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        reconnectAttempts = 0;
        connectWs();
      }
    }
  });
}

/* ---------------- 派生数据 ---------------- */

/** 在线节点数：必须按 last_active 自行判定（后端 online 字段是在线用户数） */
export const onlineServers = computed(
  () => state.servers.filter((server) => isServerOnline(state.now, server)).length,
);

export const groupNames = computed(() =>
  state.groups.map((item) => item.group.name).filter(Boolean),
);

const groupIdMap = computed(() => {
  const map = new Map<string, Set<number>>();
  for (const item of state.groups) {
    if (Array.isArray(item.servers)) map.set(item.group.name, new Set(item.servers));
  }
  return map;
});

/** 当前分组内的服务器 + 在线状态 */
export const preparedServers = computed<PreparedServer[]>(() => {
  const groupIds = state.filter.group === "all" ? null : groupIdMap.value.get(state.filter.group);
  return state.servers
    .filter((server) => (groupIds ? groupIds.has(server.id) : true))
    .map((server) => ({ server, online: isServerOnline(state.now, server) }));
});

/** 概览统计（基于当前分组） */
export const summary = computed(() => {
  let online = 0;
  let offline = 0;
  let upSpeed = 0;
  let downSpeed = 0;
  let upTotal = 0;
  let downTotal = 0;

  for (const item of preparedServers.value) {
    if (!item.online) {
      offline += 1;
      continue;
    }
    online += 1;
    upSpeed += item.server.state?.net_out_speed || 0;
    downSpeed += item.server.state?.net_in_speed || 0;
    upTotal += item.server.state?.net_out_transfer || 0;
    downTotal += item.server.state?.net_in_transfer || 0;
  }

  return { online, offline, total: preparedServers.value.length, upSpeed, downSpeed, upTotal, downTotal };
});

/** 过滤 + 排序后的服务器列表 */
export const visibleServers = computed<PreparedServer[]>(() => {
  const { status, keyword, sortKey, sortAsc } = state.filter;
  const kw = keyword.trim().toLowerCase();

  let list = preparedServers.value;

  if (status !== "all") {
    list = list.filter((item) => (status === "online" ? item.online : !item.online));
  }

  if (kw) {
    list = list.filter((item) => {
      const s = item.server;
      return (
        s.name.toLowerCase().includes(kw) ||
        (s.host?.platform || "").toLowerCase().includes(kw) ||
        (s.public_note || "").toLowerCase().includes(kw)
      );
    });
  }

  if (sortKey === "default") {
    return [...list].sort((a, b) => Number(b.online) - Number(a.online));
  }

  const metric = (item: PreparedServer): number | string => {
    const { server, online } = item;
    switch (sortKey) {
      case "name":
        return server.name || "";
      case "cpu":
        return server.state?.cpu || 0;
      case "mem":
        return (server.state?.mem_used || 0) / (server.host?.mem_total || 1);
      case "disk":
        return (server.state?.disk_used || 0) / (server.host?.disk_total || 1);
      case "up":
        return server.state?.net_out_speed || 0;
      case "down":
        return server.state?.net_in_speed || 0;
      case "uptime":
        return online ? server.state?.uptime || 0 : -1;
      default:
        return 0;
    }
  };

  return [...list].sort((a, b) => {
    // 离线服务器始终排在后面（名称排序时除外）
    if (sortKey !== "name") {
      if (a.online !== b.online) return a.online ? -1 : 1;
    }
    const va = metric(a);
    const vb = metric(b);
    let result: number;
    if (typeof va === "string" || typeof vb === "string") {
      result = String(va).localeCompare(String(vb), "zh-CN");
    } else {
      result = va - vb;
    }
    return sortAsc ? result : -result;
  });
});

export const serverById = computed(() => {
  const map = new Map<number, NezhaServer>();
  for (const server of state.servers) map.set(server.id, server);
  return map;
});

export const serviceList = computed(() => Object.values(state.services));
