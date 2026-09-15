<script setup lang="ts">
import { computed } from "vue";
import type { ServiceData } from "@/api/types";

const props = defineProps<{
  services: Record<string, ServiceData>;
}>();

interface ServiceRow {
  name: string;
  up: boolean;
  currentDelay: number;
  avgDelay: number;
  successRate: number;
  totalUp: number;
  totalDown: number;
}

const rows = computed<ServiceRow[]>(() =>
  Object.values(props.services || {})
    .map((service) => {
      const delays = Array.isArray(service.delay) ? service.delay : [];
      const valid = delays.filter((d) => typeof d === "number" && d > 0);
      const currentRaw = delays.length ? delays[delays.length - 1] : 0;
      const totalUp = service.total_up || 0;
      const totalDown = service.total_down || 0;
      const sum = totalUp + totalDown;
      return {
        name: service.service_name || "未命名服务",
        up: (service.current_up ?? 0) > 0,
        currentDelay: typeof currentRaw === "number" ? currentRaw : 0,
        avgDelay: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0,
        successRate: sum > 0 ? (totalUp / sum) * 100 : 0,
        totalUp,
        totalDown,
      };
    })
    .sort((a, b) => Number(b.up) - Number(a.up) || a.name.localeCompare(b.name, "zh-CN")),
);
</script>

<template>
  <div class="service-grid">
    <div v-for="row in rows" :key="row.name" class="service-card">
      <div class="service-card__head">
        <i class="dot" :class="row.up ? 'dot--online' : 'dot--offline'" />
        <span class="service-card__name">{{ row.name }}</span>
        <span class="badge" :class="row.up ? 'badge--online' : 'badge--offline'">
          {{ row.up ? "正常" : "异常" }}
        </span>
      </div>

      <div class="service-card__main">
        <span class="service-card__delay num">{{ row.currentDelay > 0 ? `${row.currentDelay.toFixed(0)} ms` : "-" }}</span>
        <span class="service-card__avg num">平均 {{ row.avgDelay > 0 ? `${row.avgDelay.toFixed(0)} ms` : "-" }}</span>
      </div>

      <div class="bar" style="margin-top: 8px">
        <div
          class="bar__fill"
          :class="row.successRate >= 95 ? 'bar__fill--low' : row.successRate >= 80 ? 'bar__fill--high' : 'bar__fill--critical'"
          :style="{ width: `${row.successRate}%` }"
        />
      </div>

      <div class="service-card__row">
        <span>可用率 <b class="service-card__val num">{{ row.successRate.toFixed(1) }}%</b></span>
        <span>
          <b class="num" style="color: var(--ok)">{{ row.totalUp }}</b> /
          <b class="num" style="color: var(--danger)">{{ row.totalDown }}</b>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-card__head {
  display: flex;
  align-items: center;
  gap: 7px;
}

.service-card__head .badge {
  margin-left: auto;
  height: 20px;
  font-size: 10.5px;
}

.service-card__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 9px;
}

.service-card__delay {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.service-card__avg {
  font-size: 11.5px;
  color: var(--text-faint);
}
</style>
