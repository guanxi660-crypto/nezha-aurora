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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    ...init,
  });

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
  return url.toString();
};
