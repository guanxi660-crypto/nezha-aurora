<script setup lang="ts">
import { computed } from "vue";

interface Series {
  points: number[];
  color: string;
}

const props = withDefaults(
  defineProps<{
    series: Series[];
    height?: number;
  }>(),
  { height: 30 },
);

const VIEW_WIDTH = 100;

/** 所有序列共用同一纵轴刻度，保证上下行对比可信 */
const maxValue = computed(() => {
  let max = 0;
  for (const item of props.series) {
    for (const value of item.points) {
      if (value > max) max = value;
    }
  }
  return max > 0 ? max : 1;
});

function toPath(points: number[], close: boolean) {
  const total = points.length;
  if (total < 2) return "";

  const step = VIEW_WIDTH / (total - 1);
  const usable = props.height - 4;
  const coords = points.map((value, index) => {
    const ratio = Math.min(1, Math.max(0, value / maxValue.value));
    return [index * step, props.height - 2 - ratio * usable] as const;
  });

  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  if (!close) return line;

  return `${line} L${VIEW_WIDTH} ${props.height} L0 ${props.height} Z`;
}

const seriesPaths = computed(() =>
  props.series.map((item) => ({
    line: toPath(item.points, false),
    area: toPath(item.points, true),
    color: item.color,
    hasData: item.points.length >= 2,
  })),
);

const hasAnyData = computed(() =>
  props.series.some((item) => item.points.length >= 2 && item.points.some((v) => v > 0)),
);
</script>

<template>
  <div class="spark" :style="{ height: `${height}px` }">
    <svg
      v-if="hasAnyData"
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      preserveAspectRatio="none"
      role="img"
      aria-label="实时网络速率趋势"
    >
      <g v-for="(item, index) in seriesPaths" :key="index">
        <path v-if="item.hasData" :d="item.area" :fill="item.color" opacity="0.16" />
        <path
          v-if="item.hasData"
          :d="item.line"
          :stroke="item.color"
          stroke-width="1.6"
          fill="none"
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      </g>
    </svg>
    <span v-else class="spark__hint">正在采样网络趋势…</span>
  </div>
</template>

<style scoped>
.spark {
  width: 100%;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spark svg {
  width: 100%;
  height: 100%;
  display: block;
}

.spark__hint {
  font-size: 10.5px;
  color: var(--text-faint);
}
</style>
