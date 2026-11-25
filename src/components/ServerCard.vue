<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import type { NezhaServer } from "@/api/types";
import OsIcon from "./OsIcon.vue";
import UsageBar from "./UsageBar.vue";
import {
  countryFlag,
  formatBytes,
  formatSpeed,
  formatUptimeShort,
  getOsName,
  parsePublicNote,
  percent,
  temperatureValue,
} from "@/utils/format";

const props = defineProps<{
  server: NezhaServer;
  online: boolean;
}>();

const router = useRouter();

const cpu = computed(() => Number(props.server.state?.cpu) || 0);
const memPercent = computed(() => percent(props.server.state?.mem_used, props.server.host?.mem_total));
const diskPercent = computed(() => percent(props.server.state?.disk_used, props.server.host?.disk_total));

const memHint = computed(
  () =>
    `${formatBytes(props.server.state?.mem_used, 1)} / ${formatBytes(props.server.host?.mem_total, 1)}`,
);
const diskHint = computed(
  () =>
    `${formatBytes(props.server.state?.disk_used, 1)} / ${formatBytes(props.server.host?.disk_total, 1)}`,
);

const flagCode = computed(() => {
  const code = (props.server.country_code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : "";
});
const flag = computed(() => countryFlag(props.server.country_code));
const osName = computed(() => getOsName(props.server.host?.platform));
const platformVersion = computed(() => props.server.host?.platform_version || "");
const note = computed(() => parsePublicNote(props.server.public_note));

const DAY_MS = 86400000;

/** 周期 → 月数，与官方前端 getDaysBetweenDatesWithAutoRenewal 一致 */
function cycleMonths(cycle: unknown): number {
  const c = String(cycle ?? "").trim().toLowerCase();
  switch (c) {
    case "月":
    case "m":
    case "mo":
    case "month":
    case "monthly":
      return 1;
    case "年":
    case "y":
    case "yr":
    case "year":
    case "annual":
      return 12;
    case "季":
    case "q":
    case "qr":
    case "quarterly":
      return 3;
    case "半":
    case "半年":
    case "h":
    case "half":
    case "semi-annually":
      return 6;
    default:
      return 0;
  }
}

/** 与 dayjs.add(n, "month") 一致：月末日期做 clamp，不溢出到下个月 */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(day, lastDay));
  first.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), 0);
  return first;
}

/** 官方 getNextCycleTime：每次加 months 个月，直到超过指定日期 */
function nextCycleTime(endMs: number, months: number, nowMs: number): number | null {
  if (months <= 0) return null;
  let d = new Date(endMs);
  for (let i = 0; i < 1200 && d.getTime() <= nowMs; i++) {
    d = addMonthsClamped(d, months);
  }
  return d.getTime() > nowMs ? d.getTime() : null;
}

/** 租期剩余天数：跟随 WS 推送刷新；自动续费时按周期滚动 endDate */
const expireDays = computed(() => {
  void props.server.last_active;
  const billing = note.value?.billingDataMod;
  if (!billing?.endDate) return null;
  // 官方：endDate 以 0000-00-00 开头 = 永久服务
  if (billing.endDate.startsWith("0000-00-00")) return null;
  const raw = Date.parse(billing.endDate);
  if (!Number.isFinite(raw)) return null;
  const now = Date.now();
  const months = cycleMonths(billing.cycle);
  // 非自动续费，或未到期：直接按 endDate 算（官方 getDaysBetweenDates 用 round）
  if (raw >= now || billing.autoRenewal !== "1") {
    return Math.round((raw - now) / DAY_MS);
  }
  // 官方自动续费：从 endDate 按周期月数滚动到下一个周期
  const next = nextCycleTime(raw, months, now);
  // 周期字段认不出来（months=0）就不显示，避免误导性的「已过期」
  if (next === null) return null;
  // 官方：dayjs(next).diff(now, "day") + 1
  return Math.round((next - now) / DAY_MS) + 1;
});
const expireText = computed(() => {
  const d = expireDays.value;
  if (d === null) return "";
  if (d > 0) return `剩余 ${d}天`;
  return d === 0 ? "今日到期" : `已过期 ${-d}天`;
});
const expireLevel = computed(() => {
  const d = expireDays.value;
  if (d === null) return "";
  if (d <= 0) return "expired";
  if (d <= 7) return "urgent";
  if (d <= 30) return "warn";
  return "ok";
});

/** IP 徽章：0 / 空 / 无 / false 视为未提供 */
const ipLabel = computed(() => {
  const plan = note.value?.planDataMod;
  if (!plan) return "";
  const has = (value?: string) => {
    const v = (value ?? "").trim().toLowerCase();
    return v !== "" && v !== "0" && v !== "无" && v !== "false" && v !== "no" && v !== "否";
  };
  const v4 = has(plan.IPv4);
  const v6 = has(plan.IPv6);
  if (v4 && v6) return "双栈IP";
  if (v4) return "IPv4";
  if (v6) return "IPv6";
  return "";
});

const loadText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  return `${(s.load_1 || 0).toFixed(2)}/${(s.load_5 || 0).toFixed(2)}/${(s.load_15 || 0).toFixed(2)}`;
});

const connText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  return `${s.tcp_conn_count || 0}/${s.udp_conn_count || 0}`;
});

const processText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  const value = s.process_count;
  return value === undefined || value === null ? "-" : String(value);
});

/** 出/入站累计流量，紧凑写法以压缩占用宽度 */
const flowText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  return `${formatBytes(s.net_out_transfer, 1)}↑ ${formatBytes(s.net_in_transfer, 1)}↓`;
});

const tempText = computed(() => {
  const temps = props.server.state?.temperatures;
  if (!props.online || !temps || !temps.length) return "";
  const max = Math.max(...temps.map(temperatureValue));
  return max > 0 ? `${max.toFixed(0)}°C` : "";
});

/** 温度放入 CPU 进度条下方，避免底部指标行过长导致换行 */
const tempHint = computed(() => (tempText.value ? `温度 ${tempText.value}` : ""));

/** GPU：型号取自 host.gpu，利用率/显存取自 state.gpus（旧 Agent 仅有 state.gpu 利用率） */
const gpuInfo = computed(() => {
  const names = props.server.host?.gpu || [];
  if (!names.length) return null;

  const state = props.server.state;
  const stat = state?.gpus?.[0];
  const utilization = Number(stat?.utilization ?? state?.gpu?.[0] ?? 0) || 0;

  // 后端 GPUStat 显存单位为 MiB
  const mib = 1024 * 1024;
  return {
    name: names[0],
    count: names.length,
    utilization,
    memUsed: stat?.memory_used ? stat.memory_used * mib : 0,
    memTotal: stat?.memory_total ? stat.memory_total * mib : 0,
  };
});

const gpuLabel = computed(() => {
  const gpu = gpuInfo.value;
  if (!gpu) return "";
  return gpu.count > 1 ? `GPU ×${gpu.count}` : "GPU";
});

const gpuHint = computed(() => {
  const gpu = gpuInfo.value;
  if (!gpu) return "";
  if (!gpu.memTotal) return gpu.name;
  return `${gpu.name} · 显存 ${formatBytes(gpu.memUsed, 1)} / ${formatBytes(gpu.memTotal, 1)}`;
});

const cpuInfo = computed(() => {
  const cpuList = props.server.host?.cpu;
  if (!cpuList || !cpuList.length) return "";
  return cpuList[0];
});

function open() {
  router.push(`/server/${props.server.id}`);
}
</script>

<template>
  <article
    class="server-card"
    :class="{ 'server-card--offline': !online }"
    role="link"
    tabindex="0"
    @click="open"
    @keydown.enter="open"
    @keydown.space.prevent="open"
  >
    <header class="server-card__head">
      <div class="server-card__title">
        <div class="server-card__name">
          <i class="dot" :class="online ? 'dot--online' : 'dot--offline'" />
          <span v-if="flagCode" class="server-card__flag fi" :class="`fi-${flagCode}`" :title="flag" />
          <span v-else-if="flag" class="server-card__flag">{{ flag }}</span>
          <span class="server-card__name-text">{{ server.name }}</span>
          <span v-if="expireText" class="card-chip" :class="`card-chip--${expireLevel}`">{{ expireText }}</span>
          <span v-if="ipLabel" class="card-chip card-chip--ip">{{ ipLabel }}</span>
        </div>
        <div class="server-card__meta">
          <div class="server-card__meta-row">
            <span class="server-card__os">
              <OsIcon :platform="server.host?.platform" />
              <span class="server-card__meta-text">
                {{ osName }}<template v-if="platformVersion"> {{ platformVersion }}</template>
              </span>
            </span>
            <span v-if="server.host?.arch" class="server-card__meta-fixed">
              {{ server.host.arch }}
            </span>
          </div>
          <div v-if="cpuInfo" class="server-card__meta-row">
            <span class="server-card__meta-text">{{ cpuInfo }}</span>
          </div>
        </div>
      </div>
      <div class="server-card__state">
        <span class="badge" :class="online ? 'badge--online' : 'badge--offline'">
          {{ online ? "在线" : "离线" }}
        </span>
        <span v-if="online" class="server-card__uptime num">{{ formatUptimeShort(server.state?.uptime) }}</span>
        <span v-else class="server-card__uptime">失联</span>
      </div>
    </header>

    <div class="metrics">
      <UsageBar label="CPU" :value="cpu" :hint="tempHint" />
      <UsageBar label="内存" :value="memPercent" :hint="memHint" />
      <UsageBar label="磁盘" :value="diskPercent" :hint="diskHint" />
    </div>

    <div v-if="gpuInfo" class="gpu-metric">
      <UsageBar :label="gpuLabel" :value="gpuInfo.utilization" :hint="gpuHint" />
    </div>

    <div class="net-row">
      <div class="net-cell">
        <span class="net-cell__icon net-cell__icon--up">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </span>
        <div>
          <div class="net-cell__label">上行</div>
          <div class="net-cell__value num">{{ online ? formatSpeed(server.state?.net_out_speed) : "-" }}</div>
        </div>
      </div>
      <div class="net-cell">
        <span class="net-cell__icon net-cell__icon--down">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </span>
        <div>
          <div class="net-cell__label">下行</div>
          <div class="net-cell__value num">{{ online ? formatSpeed(server.state?.net_in_speed) : "-" }}</div>
        </div>
      </div>
    </div>

    <footer class="server-card__foot">
      <span class="foot-item">负载<b class="num">{{ loadText }}</b></span>
      <span class="foot-item">连接<b class="num">{{ connText }}</b></span>
      <span class="foot-item">进程<b class="num">{{ processText }}</b></span>
      <span v-if="note?.planDataMod?.bandwidth" class="foot-item foot-item--optional">
        带宽<b class="num">{{ note.planDataMod.bandwidth }}</b>
      </span>
      <span class="foot-item foot-item--flow">流量<b class="num">{{ flowText }}</b></span>
    </footer>
  </article>
</template>

<style scoped>
/* GPU 监控条：只有带 GPU 的节点才会渲染，独占一行避免挤压 CPU/内存/磁盘 */
.gpu-metric {
  margin-top: 2px;
}

.server-card__flag {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

/* 固定两行：第一行「系统 + 架构」，第二行「CPU」，避免各卡片排版不一致 */
.server-card__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.server-card__os {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

/* 必须是块级容器，overflow + text-overflow 才会产生省略号 */
.server-card__meta-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.server-card__meta-fixed {
  flex-shrink: 0;
}

.server-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.server-card__name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 名称右侧自定义字段徽章：紧凑、语义色，名称过长时优先省略名称 */
/* 名称与首个徽章之间留两个空格的间隔，徽章之间仍用原有的 flex gap */
.server-card__name-text + .card-chip {
  margin-inline-start: 1em;
}

.card-chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 19px;
  padding: 0 7px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.card-chip--ok {
  color: var(--text-dim);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 26%, transparent);
}

.card-chip--warn {
  color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  border-color: color-mix(in srgb, var(--warn) 32%, transparent);
}

.card-chip--urgent,
.card-chip--expired {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  border-color: color-mix(in srgb, var(--danger) 32%, transparent);
}

.card-chip--ip {
  /* 固定橙色，不受面板自定义强调色（--accent/--accent-2）覆盖 */
  color: #fb923c;
  background: color-mix(in srgb, #fb923c 14%, transparent);
  border-color: color-mix(in srgb, #fb923c 32%, transparent);
}

.server-card__uptime {
  font-size: 11px;
  color: var(--text-faint);
}
</style>
