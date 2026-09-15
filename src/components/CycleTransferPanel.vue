<script setup lang="ts">
import { computed } from "vue";
import type { CycleTransferData } from "@/api/types";
import { formatBytes, usageLevel } from "@/utils/format";

const props = defineProps<{
  stats: Record<string, CycleTransferData>;
}>();

const pickNumber = (value: number | Record<string, number> | undefined, key: string) => {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return Number(value[key]) || 0;
};

const pickString = (value: string | Record<string, string> | undefined, key: string) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return value[key] || "";
};

interface CycleRow {
  id: string;
  name: string;
  serverName: string;
  transfer: number;
  max: number;
  percent: number;
  level: "low" | "mid" | "high" | "critical";
  from: string;
  to: string;
  nextUpdate: string;
}

const rows = computed<CycleRow[]>(() => {
  const result: CycleRow[] = [];
  for (const [key, item] of Object.entries(props.stats || {})) {
    const serverIds = Object.keys(item.transfer || {});
    if (!serverIds.length) {
      const max = pickNumber(item.max, key);
      const transfer = pickNumber(item.transfer, key);
      result.push({
        id: key,
        name: item.name || "流量规则",
        serverName: "",
        transfer,
        max,
        percent: max > 0 ? Math.min(100, (transfer / max) * 100) : 0,
        level: max > 0 ? usageLevel((transfer / max) * 100) : "low",
        from: pickString(item.from, key),
        to: pickString(item.to, key),
        nextUpdate: pickString(item.next_update, key),
      });
      continue;
    }

    for (const serverId of serverIds) {
      const max = pickNumber(item.max, serverId);
      const transfer = pickNumber(item.transfer, serverId);
      const percentValue = max > 0 ? Math.min(100, (transfer / max) * 100) : 0;
      result.push({
        id: `${key}-${serverId}`,
        name: item.name || "流量规则",
        serverName: item.server_name?.[serverId] || `#${serverId}`,
        transfer,
        max,
        percent: percentValue,
        level: usageLevel(percentValue),
        from: pickString(item.from, serverId),
        to: pickString(item.to, serverId),
        nextUpdate: pickString(item.next_update, serverId),
      });
    }
  }
  return result.sort((a, b) => b.percent - a.percent);
});
</script>

<template>
  <div class="cycle-grid">
    <div v-for="row in rows" :key="row.id" class="service-card">
      <div class="cycle-head">
        <span class="service-card__name">{{ row.name }}</span>
        <span class="chip num">{{ row.percent.toFixed(1) }}%</span>
      </div>
      <div v-if="row.serverName" class="cycle-server">{{ row.serverName }}</div>

      <div class="bar" style="margin-top: 10px">
        <div class="bar__fill" :class="`bar__fill--${row.level}`" :style="{ width: `${row.percent}%` }" />
      </div>

      <div class="service-card__row">
        <span class="num">{{ formatBytes(row.transfer) }}</span>
        <span class="num">{{ row.max > 0 ? `/ ${formatBytes(row.max)}` : "不限" }}</span>
      </div>

      <div v-if="row.to" class="cycle-foot num">下次重置 {{ row.to }}</div>
    </div>
  </div>
</template>

<style scoped>
.cycle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.cycle-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cycle-server {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-faint);
}

.cycle-foot {
  margin-top: 7px;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
