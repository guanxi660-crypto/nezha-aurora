import type { NezhaServer, NezhaTemperature } from "@/api/types";

/**
 * 温度取值兼容两种序列化形式。
 * 后端 model.SensorTemperature 未声明 json tag，默认输出 Name / Temperature；
 * 部分链路或旧版本可能输出小写，这里统一兜底。
 */
export function temperatureValue(item: NezhaTemperature): number {
  const value = Number(item.Temperature ?? item.temperature);
  return Number.isFinite(value) ? value : 0;
}

/** 字节数格式化，自动选择单位 */
export function formatBytes(bytes?: number, decimals = 2): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  const index = Math.min(sizes.length - 1, Math.floor(Math.log(value) / Math.log(k)));
  const fixed = index === 0 ? 0 : decimals;
  return `${(value / k ** index).toFixed(fixed)} ${sizes[index]}`;
}

/** 速率格式化（输入单位为 bytes/s） */
export function formatSpeed(bytesPerSecond?: number, decimals = 2): string {
  const value = Number(bytesPerSecond);
  if (!Number.isFinite(value) || value <= 0) return "0 B/s";
  return `${formatBytes(value, decimals)}/s`;
}

/** 秒 → 人类可读运行时长 */
export function formatUptime(seconds?: number): string {
  const value = Math.floor(Number(seconds) || 0);
  if (value <= 0) return "-";

  const day = Math.floor(value / 86400);
  const hour = Math.floor((value % 86400) / 3600);
  const minute = Math.floor((value % 3600) / 60);

  if (day > 0) return `${day}天 ${hour}小时`;
  if (hour > 0) return `${hour}小时 ${minute}分`;
  return `${minute}分 ${value % 60}秒`;
}

/** 秒 → 紧凑运行时长（卡片使用） */
export function formatUptimeShort(seconds?: number): string {
  const value = Math.floor(Number(seconds) || 0);
  if (value <= 0) return "-";

  const day = Math.floor(value / 86400);
  const hour = Math.floor((value % 86400) / 3600);
  const minute = Math.floor((value % 3600) / 60);

  if (day > 0) return `${day}d ${hour}h`;
  if (hour > 0) return `${hour}h ${minute}m`;
  return `${minute}m`;
}

/** 百分比计算，自动防除零 */
export function percent(used?: number, total?: number): number {
  const u = Number(used) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, (u / t) * 100));
}

/** 使用率对应的语义色阶 */
export function usageLevel(value: number): "low" | "mid" | "high" | "critical" {
  if (value >= 90) return "critical";
  if (value >= 75) return "high";
  if (value >= 50) return "mid";
  return "low";
}

/** 服务器是否在线（与官方前端一致的 30 秒阈值判定） */
export function isServerOnline(now: number, server: NezhaServer): boolean {
  if (!server?.last_active) return false;
  const lastActiveTime = server.last_active.startsWith("000")
    ? 0
    : Date.parse(server.last_active);
  if (!Number.isFinite(lastActiveTime)) return false;
  return now - lastActiveTime <= 30000;
}

export function formatDateTime(input?: string | number): string {
  if (input === undefined || input === null || input === "") return "-";
  const date =
    typeof input === "number" ? new Date(input * 1000) : new Date(String(input));
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export interface BillingData {
  startDate?: string;
  endDate?: string;
  autoRenewal?: string;
  cycle?: string;
  amount?: string;
}

export interface PlanData {
  bandwidth?: string;
  trafficVol?: string;
  trafficType?: string;
  IPv4?: string;
  IPv6?: string;
  networkRoute?: string;
  extra?: string;
}

export interface PublicNoteData {
  billingDataMod?: BillingData;
  planDataMod?: PlanData;
}

/** public_note 是面板写入的不透明字段，这里做容错解析 */
export function parsePublicNote(publicNote?: string): PublicNoteData | null {
  if (!publicNote) return null;
  try {
    const data = JSON.parse(publicNote);
    if (!data || typeof data !== "object") return null;
    const result: PublicNoteData = {};
    if (data.billingDataMod) result.billingDataMod = data.billingDataMod;
    if (data.planDataMod) result.planDataMod = data.planDataMod;
    return result.billingDataMod || result.planDataMod ? result : null;
  } catch {
    return null;
  }
}

const FONT_LOGO_PLATFORMS = new Set([
  "almalinux",
  "alpine",
  "aosc",
  "apple",
  "archlinux",
  "archlabs",
  "artix",
  "budgie",
  "centos",
  "coreos",
  "debian",
  "deepin",
  "devuan",
  "docker",
  "elementary",
  "fedora",
  "ferris",
  "flathub",
  "freebsd",
  "gentoo",
  "gnu-guix",
  "illumos",
  "kali-linux",
  "linuxmint",
  "mageia",
  "mandriva",
  "manjaro",
  "nixos",
  "openbsd",
  "opensuse",
  "pop-os",
  "raspberry-pi",
  "redhat",
  "rocky-linux",
  "sabayon",
  "slackware",
  "snappy",
  "solus",
  "tux",
  "ubuntu",
  "void",
  "zorin",
]);

/** 映射到 font-logos 的类名 */
export function getFontLogoClass(platform?: string): string {
  const p = (platform || "").toLowerCase();
  if (FONT_LOGO_PLATFORMS.has(p)) return p;
  if (p === "darwin" || p === "macos") return "apple";
  if (["openwrt", "linux", "immortalwrt"].includes(p)) return "tux";
  if (p === "amazon") return "redhat";
  if (p === "arch") return "archlinux";
  if (p.includes("opensuse")) return "opensuse";
  return "tux";
}

/** 展示用的系统名 */
export function getOsName(platform?: string): string {
  const p = (platform || "").toLowerCase();
  if (!p) return "Linux";
  if (p === "darwin" || p === "macos") return "macOS";
  if (["openwrt", "immortalwrt"].includes(p)) return "OpenWrt";
  if (p === "linux") return "Linux";
  if (p === "arch") return "Archlinux";
  if (p === "amazon") return "Amazon";
  if (p.startsWith("windows")) return "Windows";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** 国家/地区二字码 → emoji 旗帜 */
export function countryFlag(countryCode?: string): string {
  const code = (countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
}

/** 千分位 */
export function formatNumber(value?: number, decimals = 0): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
