<script setup lang="ts">
import { computed, ref } from "vue";

interface Series {
  points: number[];
  color: string;
}

const props = withDefaults(
  defineProps<{
    series: Series[];
    height?: number;
    /** 无数据时的占位文案 */
    hint?: string;
    /** 去掉自带底色与边框，便于嵌进卡片内部 */
    plain?: boolean;
    /** 与第一条序列 points 等长的时间戳（毫秒），提供后支持悬浮查看时间 */
    times?: number[];
    /** tooltip 中数值的单位后缀，如 "ms" */
    valueLabel?: string;
  }>(),
  { height: 30, hint: "正在采样网络趋势…", plain: false, times: undefined, valueLabel: "" },
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

/** 悬浮点的索引：按鼠标 x 比例映射到最近的采样点 */
const hoverIndex = ref<number | null>(null);
const firstSeries = computed(() => props.series[0]?.points ?? []);

function onMove(event: MouseEvent) {
  if (!props.times?.length) return;
  const points = firstSeries.value;
  if (points.length < 2) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  hoverIndex.value = Math.round(ratio * (points.length - 1));
}

function onLeave() {
  hoverIndex.value = null;
}

const hoverPoint = computed(() => {
  const i = hoverIndex.value;
  if (i === null || !props.times?.length) return null;
  const value = firstSeries.value[i];
  const ts = props.times[i];
  if (typeof value !== "number" || typeof ts !== "number") return null;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    x: (i / Math.max(1, firstSeries.value.length - 1)) * VIEW_WIDTH,
    y: props.height - 2 - (Math.min(1, Math.max(0, value / maxValue.value)) * (props.height - 4)),
    time: `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    value: `${value.toFixed(1)}${props.valueLabel}`,
    left: `${Math.min(92, Math.max(8, (i / Math.max(1, firstSeries.value.length - 1)) * 100))}%`,
  };
});
</script>

<template>
  <div
    class="spark"
    :class="{ 'spark--plain': plain, 'spark--interactive': !!times?.length }"
    :style="{ height: `${height}px` }"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <svg
      v-if="hasAnyData"
      :viewBox="`0 0 ${VIEW_WIDTH} ${height}`"
      preserveAspectRatio="none"
      role="img"
      aria-label="实时网络速率趋势"
    >
      <g v-for="(item, index) in seriesPaths" :key="index">
        <!-- 颜色走 style 而非 SVG 属性：presentation attribute 不能用 CSS 变量 -->
        <path v-if="item.hasData" :d="item.area" :style="{ fill: item.color }" opacity="0.16" />
        <path
          v-if="item.hasData"
          :d="item.line"
          :style="{ stroke: item.color }"
          stroke-width="1.6"
          fill="none"
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      </g>
      <g v-if="hoverPoint">
        <line
          :x1="hoverPoint.x"
          :x2="hoverPoint.x"
          y1="0"
          :y2="height"
          stroke="var(--text-faint)"
          stroke-width="0.5"
          stroke-dasharray="2 2"
          opacity="0.6"
        />
        <circle
          :cx="hoverPoint.x"
          :cy="hoverPoint.y"
          r="1.6"
          :style="{ fill: series[0]?.color || 'var(--accent)' }"
          stroke="var(--panel-solid)"
          stroke-width="0.4"
        />
      </g>
    </svg>
    <div v-if="hoverPoint" class="spark__tip" :style="{ left: hoverPoint.left }">
      <span class="spark__tip-time">{{ hoverPoint.time }}</span>
      <span class="spark__tip-value num">{{ hoverPoint.value }}</span>
    </div>
    <span v-else-if="!hasAnyData" class="spark__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.spark {
  position: relative;
  width: 100%;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--panel-solid) 45%, transparent);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spark--plain {
  background: transparent;
  border: none;
  border-radius: 0;
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

.spark--interactive {
  cursor: crosshair;
  /* tooltip 在曲线上方，必须允许溢出；SVG 自身受 viewBox 约束不会越界 */
  overflow: visible;
}

.spark__tip {
  position: absolute;
  bottom: calc(100% - 2px);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 7px;
  border-radius: var(--radius-sm);
  background: var(--panel-solid);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgb(0 0 0 / 25%);
  font-size: 10px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;
}

.spark__tip-time {
  color: var(--text-dim);
}

.spark__tip-value {
  color: var(--accent);
  font-weight: 600;
}
</style>
