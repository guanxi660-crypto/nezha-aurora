<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchMonitor, fetchServerMetrics } from "@/api/client";
import type { MetricDataPoint, MetricPeriod, MetricType, NezhaMonitor } from "@/api/types";
import MetricChart from "@/components/MetricChart.vue";
import MetricRing from "@/components/MetricRing.vue";
import { vFillGrid } from "@/directives/fill-grid";
import {
  countryFlag,
  formatBytes,
  formatDateTime,
  formatSpeed,
  formatUptime,
  getOsName,
  isServerOnline,
  parsePublicNote,
  percent,
  temperatureValue,
} from "@/utils/format";
import { serverById, state } from "@/store/nezha";

const props = defineProps<{ id: number }>();

interface MetricOption {
  key: MetricType;
  label: string;
  unit: "%" | "Bps" | "B" | "";
  color: string;
}

const METRICS: MetricOption[] = [
  { key: "cpu", label: "CPU", unit: "%", color: "#38bdf8" },
  { key: "memory", label: "内存", unit: "%", color: "#a78bfa" },
  { key: "swap", label: "交换分区", unit: "%", color: "#f472b6" },
  { key: "disk", label: "磁盘", unit: "%", color: "#22d3ee" },
  { key: "net_in_speed", label: "下行速率", unit: "Bps", color: "#34d399" },
  { key: "net_out_speed", label: "上行速率", unit: "Bps", color: "#fbbf24" },
  { key: "net_in_transfer", label: "下行流量", unit: "B", color: "#10b981" },
  { key: "net_out_transfer", label: "上行流量", unit: "B", color: "#f59e0b" },
  { key: "load1", label: "负载 1", unit: "", color: "#818cf8" },
  { key: "load5", label: "负载 5", unit: "", color: "#8b5cf6" },
  { key: "load15", label: "负载 15", unit: "", color: "#c084fc" },
  { key: "tcp_conn", label: "TCP 连接", unit: "", color: "#60a5fa" },
  { key: "udp_conn", label: "UDP 连接", unit: "", color: "#93c5fd" },
  { key: "process_count", label: "进程数", unit: "", color: "#facc15" },
  { key: "temperature", label: "温度", unit: "", color: "#fb7185" },
  { key: "gpu", label: "GPU", unit: "%", color: "#c084fc" },
];

const PERIODS: { key: MetricPeriod; label: string }[] = [
  { key: "1d", label: "24 小时" },
  { key: "7d", label: "7 天" },
  { key: "30d", label: "30 天" },
];

const metric = ref<MetricType>("cpu");
const period = ref<MetricPeriod>("1d");
const points = ref<MetricDataPoint[]>([]);
const chartLoading = ref(false);
const chartError = ref("");
const monitors = ref<NezhaMonitor[]>([]);

const server = computed(() => serverById.value.get(props.id));
const flagCode = computed(() => {
  const code = (server.value?.country_code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : "";
});
const online = computed(() => (server.value ? isServerOnline(state.now, server.value) : false));
const currentMetric = computed(() => METRICS.find((m) => m.key === metric.value) || METRICS[0]);

const formatter = computed(() => {
  switch (currentMetric.value.unit) {
    case "%":
      return (v: number) => `${(Number(v) || 0).toFixed(2)}%`;
    case "Bps":
      return (v: number) => formatSpeed(v);
    case "B":
      return (v: number) => formatBytes(v);
    default:
      return (v: number) => (Number(v) || 0).toFixed(2);
  }
});

const note = computed(() => (server.value ? parsePublicNote(server.value.public_note) : null));

const memPercent = computed(() => percent(server.value?.state?.mem_used, server.value?.host?.mem_total));
const diskPercent = computed(() => percent(server.value?.state?.disk_used, server.value?.host?.disk_total));
const swapPercent = computed(() => percent(server.value?.state?.swap_used, server.value?.host?.swap_total));

const temperatures = computed(() => server.value?.state?.temperatures || []);

/** GPU 列表：型号 + 利用率 + 显存（后端 GPUStat 显存单位为 MiB） */
const gpuStats = computed(() => {
  const names = server.value?.host?.gpu || [];
  const state = server.value?.state;
  const mib = 1024 * 1024;
  return names.map((name, index) => {
    const stat = state?.gpus?.[index];
    const rawUtilization = stat?.utilization ?? state?.gpu?.[index];
    return {
      name,
      hasUtilization: rawUtilization !== undefined && rawUtilization !== null,
      utilization: Number(rawUtilization) || 0,
      memUsed: stat?.memory_used ? stat.memory_used * mib : 0,
      memTotal: stat?.memory_total ? stat.memory_total * mib : 0,
    };
  });
});

const cpuCores = computed(() => server.value?.host?.cpu?.length || 0);

async function loadMetrics() {
  if (!props.id) return;
  chartLoading.value = true;
  chartError.value = "";
  try {
    const data = await fetchServerMetrics(props.id, metric.value, period.value);
    points.value = data?.data_points || [];
  } catch (error) {
    points.value = [];
    chartError.value = error instanceof Error ? error.message : String(error);
  } finally {
    chartLoading.value = false;
  }
}

async function loadMonitors() {
  if (!props.id) return;
  try {
    const data = await fetchMonitor(props.id, "1d");
    monitors.value = Array.isArray(data) ? data : [];
  } catch {
    monitors.value = [];
  }
}

watch(
  () => [props.id, metric.value, period.value] as const,
  () => {
    void loadMetrics();
  },
  { immediate: true },
);

watch(
  () => props.id,
  () => {
    void loadMonitors();
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <div v-if="!server" class="state-block">
      <span class="spinner" />
      <p>正在读取节点数据…</p>
      <router-link class="badge badge--ghost" to="/">返回首页</router-link>
    </div>

    <template v-else>
      <section class="panel detail-hero">
        <div class="detail-hero__main">
          <div class="detail-hero__name">
            <i class="dot" :class="online ? 'dot--online' : 'dot--offline'" />
            <span
              v-if="flagCode"
              class="fi detail-hero__flag"
              :class="`fi-${flagCode}`"
              :title="countryFlag(server.country_code)"
            />
            <span>{{ server.name }}</span>
          </div>
          <div class="detail-hero__sub">
            <span>{{ getOsName(server.host?.platform) }} {{ server.host?.platform_version }}</span>
            <span>{{ server.host?.arch }}</span>
            <span v-if="cpuCores">{{ cpuCores }} 核</span>
            <span>运行 {{ online ? formatUptime(server.state?.uptime) : "-" }}</span>
            <span>{{ online ? "在线" : "离线" }}</span>
          </div>
        </div>

        <div class="rings">
          <MetricRing label="CPU" :value="server.state?.cpu || 0" :size="68" />
          <MetricRing label="内存" :value="memPercent" :size="68" />
          <MetricRing label="磁盘" :value="diskPercent" :size="68" />
          <MetricRing label="交换" :value="swapPercent" :size="68" />
        </div>
      </section>

      <section class="panel detail-section">
        <div class="detail-section__head">
          <h2 class="section-title">系统信息</h2>
        </div>

        <div v-fill-grid class="info-grid">
          <div class="info-cell">
            <span class="info-cell__label">主机名</span>
            <span class="info-cell__value">{{ server.name }}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">操作系统</span>
            <span class="info-cell__value">
              {{ getOsName(server.host?.platform) }} {{ server.host?.platform_version }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">架构</span>
            <span class="info-cell__value">{{ server.host?.arch || "-" }}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">CPU</span>
            <span class="info-cell__value">{{ server.host?.cpu?.[0] || "-" }}</span>
          </div>
          <div class="info-cell" v-for="(gpu, index) in gpuStats" :key="`gpu-${index}`">
            <span class="info-cell__label">GPU{{ gpuStats.length > 1 ? ` ${index + 1}` : "" }}</span>
            <span class="info-cell__value">
              {{ gpu.name }}
              <template v-if="gpu.hasUtilization"> · {{ gpu.utilization.toFixed(1) }}%</template>
              <template v-if="gpu.memTotal">
                · {{ formatBytes(gpu.memUsed, 1) }} / {{ formatBytes(gpu.memTotal, 1) }}
              </template>
            </span>
          </div>
          <div v-if="!gpuStats.length" class="info-cell">
            <span class="info-cell__label">GPU</span>
            <span class="info-cell__value">-</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">内存</span>
            <span class="info-cell__value num">
              {{ formatBytes(server.state?.mem_used, 1) }} / {{ formatBytes(server.host?.mem_total, 1) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">交换分区</span>
            <span class="info-cell__value num">
              {{ formatBytes(server.state?.swap_used, 1) }} / {{ formatBytes(server.host?.swap_total, 1) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">磁盘</span>
            <span class="info-cell__value num">
              {{ formatBytes(server.state?.disk_used, 1) }} / {{ formatBytes(server.host?.disk_total, 1) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">负载</span>
            <span class="info-cell__value num">
              {{ (server.state?.load_1 || 0).toFixed(2) }} /
              {{ (server.state?.load_5 || 0).toFixed(2) }} /
              {{ (server.state?.load_15 || 0).toFixed(2) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">连接数（TCP / UDP）</span>
            <span class="info-cell__value num">
              {{ server.state?.tcp_conn_count || 0 }} / {{ server.state?.udp_conn_count || 0 }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">进程数</span>
            <span class="info-cell__value num">{{ server.state?.process_count || 0 }}</span>
          </div>
          <div v-if="!temperatures.length" class="info-cell">
            <span class="info-cell__label">温度</span>
            <span class="info-cell__value">-</span>
          </div>
          <div class="info-cell" v-for="(temp, index) in temperatures" :key="`temp-${index}`">
            <span class="info-cell__label">
              温度 {{ temp.Name || temp.name || index + 1 }}
            </span>
            <span class="info-cell__value num">{{ temperatureValue(temp).toFixed(1) }} °C</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">上行累计 / 实时</span>
            <span class="info-cell__value num">
              {{ formatBytes(server.state?.net_out_transfer) }} ·
              {{ formatSpeed(server.state?.net_out_speed) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">下行累计 / 实时</span>
            <span class="info-cell__value num">
              {{ formatBytes(server.state?.net_in_transfer) }} ·
              {{ formatSpeed(server.state?.net_in_speed) }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">启动时间</span>
            <span class="info-cell__value num">{{ formatDateTime(server.host?.boot_time) }}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">运行时长</span>
            <span class="info-cell__value num">
              {{ online ? formatUptime(server.state?.uptime) : "-" }}
            </span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">最后上报</span>
            <span class="info-cell__value num">{{ formatDateTime(server.last_active) }}</span>
          </div>
          <div class="info-cell">
            <span class="info-cell__label">Agent 版本</span>
            <span class="info-cell__value">{{ server.host?.version || "-" }}</span>
          </div>
        </div>

        <div
          v-if="note?.planDataMod || note?.billingDataMod"
          v-fill-grid
          class="info-grid"
          style="margin-top: 12px"
        >
          <template v-if="note?.planDataMod">
            <div class="info-cell" v-if="note.planDataMod.bandwidth">
              <span class="info-cell__label">带宽</span>
              <span class="info-cell__value">{{ note.planDataMod.bandwidth }}</span>
            </div>
            <div class="info-cell" v-if="note.planDataMod.trafficVol">
              <span class="info-cell__label">流量额度</span>
              <span class="info-cell__value">{{ note.planDataMod.trafficVol }}</span>
            </div>
            <div class="info-cell" v-if="note.planDataMod.IPv4">
              <span class="info-cell__label">IPv4</span>
              <span class="info-cell__value">{{ note.planDataMod.IPv4 }}</span>
            </div>
            <div class="info-cell" v-if="note.planDataMod.IPv6">
              <span class="info-cell__label">IPv6</span>
              <span class="info-cell__value">{{ note.planDataMod.IPv6 }}</span>
            </div>
            <div class="info-cell" v-if="note.planDataMod.networkRoute">
              <span class="info-cell__label">线路</span>
              <span class="info-cell__value">{{ note.planDataMod.networkRoute }}</span>
            </div>
          </template>
          <template v-if="note?.billingDataMod">
            <div class="info-cell" v-if="note.billingDataMod.amount">
              <span class="info-cell__label">价格</span>
              <span class="info-cell__value">{{ note.billingDataMod.amount }}</span>
            </div>
            <div class="info-cell" v-if="note.billingDataMod.endDate">
              <span class="info-cell__label">到期时间</span>
              <span class="info-cell__value">{{ note.billingDataMod.endDate }}</span>
            </div>
            <div class="info-cell" v-if="note.billingDataMod.cycle">
              <span class="info-cell__label">计费周期</span>
              <span class="info-cell__value">{{ note.billingDataMod.cycle }}</span>
            </div>
          </template>
        </div>
      </section>

      <section class="panel detail-section">
        <div class="detail-section__head">
          <h2 class="section-title">历史曲线</h2>
          <div class="detail-section__tools">
            <select v-model="metric" class="select" aria-label="指标">
              <option v-for="item in METRICS" :key="item.key" :value="item.key">
                {{ item.label }}
              </option>
            </select>
            <div class="seg">
              <button
                v-for="item in PERIODS"
                :key="item.key"
                type="button"
                :class="{ 'is-active': period === item.key }"
                @click="period = item.key"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="chartError" class="detail-hint detail-hint--error">
          曲线读取失败：{{ chartError }}
        </p>
        <p v-else-if="!points.length && !chartLoading" class="detail-hint">
          该时间段暂无历史数据。部分指标需要面板启用 TSDB 后才有记录。
        </p>

        <MetricChart
          :points="points"
          :name="currentMetric.label"
          :color="currentMetric.color"
          :formatter="formatter"
          :loading="chartLoading"
        />
      </section>

      <section v-if="monitors.length" class="panel detail-section">
        <div class="detail-section__head">
          <h2 class="section-title">服务监控（近 24 小时）</h2>
        </div>
        <div class="service-grid">
          <div v-for="item in monitors" :key="item.monitor_id + '-' + item.server_id" class="service-card">
            <div class="service-card__head">
              <i class="dot dot--online" />
              <span class="service-card__name">{{ item.monitor_name }}</span>
              <span class="badge badge--ghost">#{{ item.server_name }}</span>
            </div>
            <div class="service-card__main">
              <span class="service-card__delay num">
                {{
                  item.avg_delay?.length
                    ? `${item.avg_delay[item.avg_delay.length - 1].toFixed(0)} ms`
                    : "-"
                }}
              </span>
              <span class="service-card__avg num">
                平均
                {{
                  item.avg_delay?.length
                    ? `${(item.avg_delay.reduce((a, b) => a + b, 0) / item.avg_delay.length).toFixed(0)} ms`
                    : "-"
                }}
              </span>
            </div>
            <div class="service-card__row" v-if="item.packet_loss?.length">
              <span>丢包率</span>
              <span class="service-card__val num">
                {{ (item.packet_loss[item.packet_loss.length - 1] ?? 0).toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rings {
  margin-left: auto;
}

.detail-section {
  margin-top: 14px;
  padding: 16px 16px 18px;
}

.detail-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.detail-section__tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-hint {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--text-faint);
}

.detail-hint--error {
  color: var(--danger);
}

.detail-hero__flag {
  font-size: 18px;
  line-height: 1;
  border-radius: 3px;
}
</style>
