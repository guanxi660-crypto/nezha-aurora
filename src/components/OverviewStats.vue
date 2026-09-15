<script setup lang="ts">
import { computed } from "vue";
import { formatBytes, formatUptimeShort } from "@/utils/format";
import { state, summary } from "@/store/nezha";

const longestUptime = computed(() => {
  let max = 0;
  for (const item of state.servers) {
    const uptime = item.state?.uptime || 0;
    if (uptime > max) max = uptime;
  }
  return max;
});

const onlineRate = computed(() => {
  const total = summary.value.total;
  if (!total) return 0;
  return (summary.value.online / total) * 100;
});
</script>

<template>
  <section class="overview-grid">
    <div class="overview-card">
      <div class="overview-card__label">在线节点</div>
      <div class="overview-card__value num">
        {{ summary.online }}
        <span class="overview-card__unit">/ {{ summary.total }}</span>
      </div>
      <div class="overview-card__foot">
        <span class="num">{{ onlineRate.toFixed(0) }}%</span> 在线 ·
        <span class="num">{{ summary.offline }}</span> 离线
      </div>
    </div>

    <div class="overview-card">
      <div class="overview-card__label">实时上行</div>
      <div class="overview-card__value num">
        {{ formatBytes(summary.upSpeed) }}
        <span class="overview-card__unit">/s</span>
      </div>
      <div class="overview-card__foot">累计 {{ formatBytes(summary.upTotal) }}</div>
    </div>

    <div class="overview-card">
      <div class="overview-card__label">实时下行</div>
      <div class="overview-card__value num">
        {{ formatBytes(summary.downSpeed) }}
        <span class="overview-card__unit">/s</span>
      </div>
      <div class="overview-card__foot">累计 {{ formatBytes(summary.downTotal) }}</div>
    </div>

    <div class="overview-card">
      <div class="overview-card__label">总流量</div>
      <div class="overview-card__value num">
        {{ formatBytes(summary.upTotal + summary.downTotal) }}
      </div>
      <div class="overview-card__foot">
        ↑ {{ formatBytes(summary.upTotal) }} · ↓ {{ formatBytes(summary.downTotal) }}
      </div>
    </div>

    <div class="overview-card">
      <div class="overview-card__label">最长运行</div>
      <div class="overview-card__value num">{{ formatUptimeShort(longestUptime) }}</div>
      <div class="overview-card__foot">全部节点中的最长在线时长</div>
    </div>
  </section>
</template>
