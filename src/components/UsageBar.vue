<script setup lang="ts">
import { computed } from "vue";
import { usageLevel } from "@/utils/format";

const props = withDefaults(
  defineProps<{
    value?: number;
    label?: string;
    text?: string;
    hint?: string;
  }>(),
  { value: 0, label: "", text: "", hint: "" },
);

const safeValue = computed(() => Math.min(100, Math.max(0, Number(props.value) || 0)));
const level = computed(() => usageLevel(safeValue.value));
const display = computed(() => props.text || `${safeValue.value.toFixed(1)}%`);
</script>

<template>
  <div class="usage">
    <div class="metric__head">
      <span>{{ label }}</span>
      <span class="metric__value num">{{ display }}</span>
    </div>
    <div class="bar">
      <div class="bar__fill" :class="`bar__fill--${level}`" :style="{ width: `${safeValue}%` }" />
    </div>
    <div v-if="hint" class="usage__hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.usage__hint {
  margin-top: 4px;
  font-size: 10.5px;
  color: var(--text-faint);
}
</style>
