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

const loadText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  return `${(s.load_1 || 0).toFixed(2)} / ${(s.load_5 || 0).toFixed(2)} / ${(s.load_15 || 0).toFixed(2)}`;
});

const connText = computed(() => {
  const s = props.server.state;
  if (!props.online || !s) return "-";
  return `${s.tcp_conn_count || 0} / ${s.udp_conn_count || 0}`;
});

const tempText = computed(() => {
  const temps = props.server.state?.temperatures;
  if (!props.online || !temps || !temps.length) return "";
  return `${Math.max(...temps.map((t) => t.Temperature)).toFixed(0)}°C`;
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
  >
    <header class="server-card__head">
      <div class="server-card__title">
        <div class="server-card__name">
          <i class="dot" :class="online ? 'dot--online' : 'dot--offline'" />
          <span v-if="flagCode" class="server-card__flag fi" :class="`fi-${flagCode}`" :title="flag" />
          <span v-else-if="flag" class="server-card__flag">{{ flag }}</span>
          <span class="server-card__name-text">{{ server.name }}</span>
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
      <UsageBar label="CPU" :value="cpu" />
      <UsageBar label="内存" :value="memPercent" :hint="memHint" />
      <UsageBar label="磁盘" :value="diskPercent" :hint="diskHint" />
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
      <span>负载 <b class="num">{{ loadText }}</b></span>
      <span>连接 <b class="num">{{ connText }}</b></span>
      <span v-if="online">进程 <b class="num">{{ server.state?.process_count ?? "-" }}</b></span>
      <span v-if="tempText">温度 <b class="num">{{ tempText }}</b></span>
      <span>
        流量 <b class="num">{{ formatBytes(server.state?.net_out_transfer, 1) }}</b> ↑ /
        <b class="num">{{ formatBytes(server.state?.net_in_transfer, 1) }}</b> ↓
      </span>
      <span v-if="note?.planDataMod?.bandwidth">带宽 <b>{{ note.planDataMod.bandwidth }}</b></span>
    </footer>
  </article>
</template>

<style scoped>
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

.server-card__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-card__uptime {
  font-size: 11px;
  color: var(--text-faint);
}
</style>
