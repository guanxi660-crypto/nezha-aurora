<script setup lang="ts">
import { computed } from "vue";
import { usageLevel } from "@/utils/format";

const props = withDefaults(
  defineProps<{
    value?: number;
    label?: string;
    size?: number;
    text?: string;
    showValue?: boolean;
  }>(),
  { value: 0, label: "", size: 64, text: "", showValue: true },
);

const safeValue = computed(() => Math.min(100, Math.max(0, Number(props.value) || 0)));
const level = computed(() => usageLevel(safeValue.value));

const stroke = 5;
const radius = computed(() => (props.size - stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dash = computed(() => (safeValue.value / 100) * circumference.value);

const colorVar = computed(() => {
  switch (level.value) {
    case "critical":
      return "var(--danger)";
    case "high":
      return "var(--warn)";
    case "mid":
      return "var(--accent)";
    default:
      return "var(--ok)";
  }
});
</script>

<template>
  <div class="ring-wrap">
    <div class="ring" :style="{ '--size': `${size}px` }">
      <svg :width="size" :height="size">
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          stroke="color-mix(in srgb, var(--text-faint) 22%, transparent)"
          :stroke-width="stroke"
        />
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="colorVar"
          :stroke-width="stroke"
          stroke-linecap="round"
          :stroke-dasharray="`${dash} ${circumference}`"
          style="transition: stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
        />
      </svg>
      <span v-if="showValue" class="ring__label num">{{ text || `${safeValue.toFixed(0)}%` }}</span>
    </div>
    <span v-if="label" class="ring-caption">{{ label }}</span>
  </div>
</template>

<style scoped>
.ring-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.ring-caption {
  font-size: 11px;
  color: var(--text-faint);
  letter-spacing: 0.02em;
}
</style>
