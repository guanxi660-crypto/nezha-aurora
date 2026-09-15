/**
 * 哪吒监控 V2 用户前端 API 数据结构
 * 与 nezha-dash-v2 / nezha-pixel 使用的字段保持完全一致
 */

export interface NezhaServerHost {
  platform: string;
  platform_version: string;
  cpu: string[];
  gpu: string[];
  mem_total: number;
  disk_total: number;
  swap_total: number;
  arch: string;
  boot_time: number;
  version: string;
  virtualization?: string;
}

export interface NezhaTemperature {
  Name: string;
  Temperature: number;
}

export interface NezhaGpuState {
  utilization: number;
  memory_used?: number;
  memory_total?: number;
}

export interface NezhaServerState {
  cpu: number;
  mem_used: number;
  swap_used: number;
  disk_used: number;
  net_in_transfer: number;
  net_out_transfer: number;
  net_in_speed: number;
  net_out_speed: number;
  uptime: number;
  load_1: number;
  load_5: number;
  load_15: number;
  tcp_conn_count: number;
  udp_conn_count: number;
  process_count: number;
  temperatures: NezhaTemperature[] | null;
  gpu: number[] | null;
  /** 与 host.gpu 下标对齐，旧版 Agent 可能不存在该字段 */
  gpus?: NezhaGpuState[];
}

export interface NezhaServer {
  id: number;
  name: string;
  public_note: string;
  last_active: string;
  country_code: string;
  host: NezhaServerHost;
  state: NezhaServerState;
}

export interface NezhaWebsocketResponse {
  now: number;
  online?: number;
  servers: NezhaServer[];
}

export interface ServerGroup {
  group: {
    id: number;
    created_at: string;
    updated_at: string;
    name: string;
  };
  servers: number[];
}

export interface ServiceData {
  service_name: string;
  current_up: number;
  current_down: number;
  total_up: number;
  total_down: number;
  delay: number[];
  up: number[];
  down: number[];
}

export interface CycleTransferData {
  name: string;
  from: string | Record<string, string>;
  to: string | Record<string, string>;
  max: number | Record<string, number>;
  min: number | Record<string, number>;
  server_name: Record<string, string>;
  transfer: Record<string, number>;
  next_update: Record<string, string>;
}

export interface NezhaMonitor {
  monitor_id: number;
  monitor_name: string;
  display_index?: number;
  server_id: number;
  server_name: string;
  created_at: number[];
  avg_delay: number[];
  packet_loss?: number[];
}

export type MetricType =
  | "cpu"
  | "memory"
  | "swap"
  | "disk"
  | "net_in_speed"
  | "net_out_speed"
  | "net_in_transfer"
  | "net_out_transfer"
  | "load1"
  | "load5"
  | "load15"
  | "tcp_conn"
  | "udp_conn"
  | "process_count"
  | "temperature"
  | "uptime"
  | "gpu";

export type MetricPeriod = "1d" | "7d" | "30d";

export interface MetricDataPoint {
  ts: number;
  value: number;
}

export interface ServerMetricsData {
  server_id: number;
  server_name: string;
  metric: string;
  data_points: MetricDataPoint[];
}

export interface NezhaFrontendTemplate {
  path: string;
  name?: string;
  repository?: string;
  author?: string;
  version?: string;
  is_admin?: boolean;
  is_official?: boolean;
}

export interface NezhaSettingConfig {
  debug?: boolean;
  language?: string;
  site_name?: string;
  user_template?: string;
  admin_template?: string;
  custom_code?: string;
  custom_code_dashboard?: string;
}

export interface NezhaSetting {
  config: NezhaSettingConfig;
  version: string;
  frontend_templates?: NezhaFrontendTemplate[];
  tsdb_enabled?: boolean;
}

/** 后端统一响应包装 */
export interface ApiResponse<T> {
  success?: boolean;
  data: T;
  error?: string;
}

/** 站点公开信息（/api/v1/setting）+ 主题运行时状态 */
export interface SiteState {
  siteName: string;
  language: string;
  customCode: string;
  version: string;
  tsdbEnabled: boolean;
  loaded: boolean;
  error: string | null;
}

/** public_note 中可能携带的 JSON 扩展字段 */
export interface ServerPublicNote {
  orderLink?: string;
  saleLink?: string;
  [key: string]: unknown;
}
