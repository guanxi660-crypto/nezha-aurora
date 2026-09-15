import { accessToken, clearAccessToken } from "@/utils/auth";
import type {
  ApiResponse,
  MetricPeriod,
  MetricType,
  NezhaMonitor,
  NezhaSetting,
  ServerGroup,
  ServerMetricsData,
  ServiceData,
  CycleTransferData,
} from "./types";

/** 所有请求都走同源 /api/v1，由外层反向代理转发给哪吒后端 */
const BASE = "/api/v1";

/** 配置了令牌时以管理员身份请求，可获得未被裁剪的完整 Host 数据 */
function authHeaders(): Record<string, string> {
  return accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });

  if (response.status === 401 && accessToken.value) {
    // 令牌失效（过期或被吊销）：清除后按访客身份重试一次，避免整站不可用。
    // 重试时 accessToken 已为空，不会再次进入该分支。
    clearAccessToken();
    return request<T>(path, init);
  }

  if (!response.ok) {
    throw new Error(`请求失败：${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ApiResponse<T> & { error?: string };
  if (payload && typeof payload === "object" && payload.error) {
    throw new Error(payload.error);
  }
  return (payload?.data ?? payload) as T;
}

export function fetchSetting(): Promise<NezhaSetting> {
  return request<NezhaSetting>("/setting");
}

export function fetchServerGroup(): Promise<ServerGroup[]> {
  return request<ServerGroup[]>("/server-group");
}

export function fetchService(): Promise<{
  services: Record<string, ServiceData>;
  cycle_transfer_stats: Record<string, CycleTransferData>;
}> {
  return request("/service");
}

export function fetchMonitor(serverId: number, period: MetricPeriod = "1d"): Promise<NezhaMonitor[]> {
  return request<NezhaMonitor[]>(`/server/${serverId}/service?period=${period}`);
}

export function fetchServerMetrics(
  serverId: number,
  metric: MetricType,
  period: MetricPeriod = "1d",
): Promise<ServerMetricsData> {
  return request<ServerMetricsData>(`/server/${serverId}/metrics?metric=${metric}&period=${period}`);
}

export const wsServerUrl = (): string => {
  const url = new URL(`${BASE}/ws/server`, window.location.origin);
  url.protocol = url.protocol.replace(/^http/, "ws");
  // 浏览器 WebSocket 无法设置请求头，后端为此保留了 query 形式的令牌校验
  if (accessToken.value) url.searchParams.set("token", accessToken.value);
  return url.toString();
};
