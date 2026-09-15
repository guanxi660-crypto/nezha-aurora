<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { MetricDataPoint } from "@/api/types";
import { theme } from "@/store/theme";

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, CanvasRenderer]);

const props = withDefaults(
  defineProps<{
    points: MetricDataPoint[];
    name?: string;
    color?: string;
    formatter?: (value: number) => string;
    loading?: boolean;
    showZoom?: boolean;
  }>(),
  {
    name: "",
    color: "#38bdf8",
    loading: false,
    showZoom: true,
  },
);

const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;

const format = (value: number) =>
  props.formatter ? props.formatter(value) : String(Math.round(value * 100) / 100);

const textColor = computed(() => (theme.value === "dark" ? "#93a4c0" : "#5a6b87"));
const gridColor = computed(() =>
  theme.value === "dark" ? "rgba(148,178,255,0.10)" : "rgba(15,23,42,0.07)",
);

function buildOption(): echarts.EChartsCoreOption {
  const data = (props.points || []).map((point) => [point.ts, point.value]);

  return {
    animationDuration: 420,
    grid: {
      left: 8,
      right: 12,
      top: 18,
      bottom: props.showZoom ? 44 : 8,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: theme.value === "dark" ? "rgba(16,26,45,0.94)" : "rgba(255,255,255,0.96)",
      borderColor: gridColor.value,
      borderWidth: 1,
      textStyle: { color: theme.value === "dark" ? "#e9effb" : "#0f172a", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: props.color, type: "dashed" } },
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? params : [params];
        const first = list[0] as { value: [number, number] } | undefined;
        if (!first) return "";
        const [ts, value] = first.value;
        const time = new Date(ts).toLocaleString("zh-CN", { hour12: false });
        return `<div style="font-size:11px;opacity:.7">${time}</div><div style="font-weight:600">${
          props.name ? `${props.name}：` : ""
        }${format(value)}</div>`;
      },
    },
    xAxis: {
      type: "time",
      boundaryGap: false,
      axisLine: { lineStyle: { color: gridColor.value } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { color: textColor.value, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: gridColor.value } },
      axisLabel: {
        color: textColor.value,
        fontSize: 11,
        formatter: (value: number) => format(value),
      },
    },
    dataZoom: props.showZoom
      ? [
          {
            type: "inside",
            throttle: 60,
            // 不抢占页面滚轮：缩放交给下方滑块，图表内仍可按住拖拽平移
            zoomOnMouseWheel: false,
            moveOnMouseWheel: false,
            moveOnMouseMove: true,
          },
          {
            type: "slider",
            height: 18,
            bottom: 8,
            borderColor: "transparent",
            backgroundColor: "transparent",
            fillerColor:
              theme.value === "dark" ? "rgba(56,189,248,0.14)" : "rgba(14,165,233,0.12)",
            handleStyle: { color: props.color, borderColor: props.color },
            textStyle: { color: textColor.value, fontSize: 10 },
          },
        ]
      : undefined,
    series: [
      {
        name: props.name,
        type: "line",
        showSymbol: false,
        smooth: 0.25,
        sampling: "lttb",
        lineStyle: { width: 2, color: props.color },
        itemStyle: { color: props.color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${props.color}55` },
            { offset: 1, color: `${props.color}00` },
          ]),
        },
        data,
      },
    ],
  };
}

function render() {
  if (!chart) return;
  chart.setOption(buildOption(), true);
}

function resize() {
  chart?.resize();
}

/**
 * 让页面滚动优先于图表缩放。
 *
 * ECharts / zrender 会在内部对 wheel 事件调用 preventDefault，
 * 导致鼠标经过图表时页面滚不动；这里在捕获阶段截断事件，
 * 使其不进入 ECharts（缩放改由下方滑块完成，拖拽平移不受影响）。
 */
function blockWheel(event: WheelEvent) {
  event.stopPropagation();
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value, undefined, { renderer: "canvas" });
  render();
  observer = new ResizeObserver(() => resize());
  observer.observe(el.value);
  el.value.addEventListener("wheel", blockWheel, { capture: true, passive: true });
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  el.value?.removeEventListener("wheel", blockWheel, { capture: true });
  chart?.dispose();
  chart = null;
});

watch(() => [props.points, props.color, props.name, theme.value], render, { deep: false });
</script>

<template>
  <div class="chart-wrap">
    <div ref="el" class="chart-box" />
    <div v-if="loading" class="chart-loading">
      <span class="spinner" />
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
}

.chart-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--panel-solid) 55%, transparent);
  border-radius: var(--radius-md);
}
</style>
