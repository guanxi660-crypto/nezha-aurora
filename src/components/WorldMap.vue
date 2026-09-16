<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { PreparedServer } from "@/store/nezha";
import { countryFlag, formatSpeed, percent } from "@/utils/format";
import { centroidOf } from "@/utils/country-centroids";

const props = defineProps<{
  items: PreparedServer[];
}>();

const router = useRouter();

const WIDTH = 960;
const HEIGHT = 500;

const ready = ref(false);
const failed = ref(false);
const landPaths = ref<string[]>([]);

/** 投影函数不放入响应式系统，避免深层代理带来的性能损失 */
let project: ((coords: [number, number]) => [number, number] | null) | null = null;

interface Cluster {
  code: string;
  x: number;
  y: number;
  online: number;
  offline: number;
  entries: PreparedServer[];
}

const clusters = computed<Cluster[]>(() => {
  if (!ready.value || !project) return [];

  const grouped = new Map<string, PreparedServer[]>();
  for (const item of props.items) {
    const code = (item.server.country_code || "").trim().toUpperCase();
    if (!code) continue;
    const list = grouped.get(code);
    if (list) list.push(item);
    else grouped.set(code, [item]);
  }

  const result: Cluster[] = [];
  for (const [code, entries] of grouped) {
    const centroid = centroidOf(code);
    if (!centroid) continue;
    const [lat, lng] = centroid;
    const point = project([lng, lat]);
    if (!point) continue;

    result.push({
      code,
      x: Number(point[0].toFixed(2)),
      y: Number(point[1].toFixed(2)),
      online: entries.filter((item) => item.online).length,
      offline: entries.filter((item) => !item.online).length,
      entries: entries.sort((a, b) => Number(b.online) - Number(a.online)),
    });
  }
  return result;
});

const locatedCount = computed(() =>
  clusters.value.reduce((sum, cluster) => sum + cluster.entries.length, 0),
);

const tooltip = ref<{ x: number; y: number; cluster: Cluster } | null>(null);

/** 位置更新走 rAF 节流；mousemove 触发频率远高于渲染帧，直连会造成大量无谓更新 */
let moveFrame = 0;

function showTooltip(cluster: Cluster, event: MouseEvent) {
  // 同一个圆点内移动时只刷新坐标，避免反复重建整个国家列表
  if (tooltip.value?.cluster === cluster) {
    moveTooltip(event);
    return;
  }
  tooltip.value = { x: event.offsetX, y: event.offsetY, cluster };
}

function moveTooltip(event: MouseEvent) {
  if (moveFrame) return;
  const x = event.offsetX;
  const y = event.offsetY;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0;
    const current = tooltip.value;
    if (!current) return;
    current.x = x;
    current.y = y;
  });
}

function hideTooltip() {
  if (moveFrame) {
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
  }
  tooltip.value = null;
}

function openServer(id: number) {
  router.push(`/server/${id}`);
}

onMounted(async () => {
  try {
    const [d3, topojson, atlasModule] = await Promise.all([
      import("d3-geo"),
      import("topojson-client"),
      import("world-atlas/countries-110m.json"),
    ]);

    const atlas = (atlasModule.default ?? atlasModule) as unknown as {
      objects: { countries: unknown };
    };
    const features = topojson.feature(
      atlas as never,
      atlas.objects.countries as never,
    ) as unknown as { features: unknown[] };

    const projection = d3.geoNaturalEarth1();
    projection.fitExtent(
      [
        [12, 12],
        [WIDTH - 12, HEIGHT - 12],
      ],
      features as never,
    );

    const pathGenerator = d3.geoPath(projection);
    landPaths.value = features.features
      .map((feature) => pathGenerator(feature as never))
      .filter((path): path is string => Boolean(path));

    project = (coords) => {
      const point = projection(coords);
      return point ? [point[0], point[1]] : null;
    };
    ready.value = true;
  } catch (error) {
    failed.value = true;
    console.error("[Aurora] 世界地图加载失败", error);
  }
});
</script>

<template>
  <div class="world-map panel">
    <div v-if="failed" class="world-map__state">地图资源加载失败，请检查网络或改用本地依赖。</div>
    <div v-else-if="!ready" class="world-map__state">
      <span class="spinner" />
      <span>正在加载地图数据…</span>
    </div>

    <template v-else>
      <div class="world-map__legend">
        <span class="chip">
          <i class="dot dot--online" /> 在线 {{ items.filter((i) => i.online).length }}
        </span>
        <span class="chip">
          <i class="dot dot--offline" /> 离线 {{ items.filter((i) => !i.online).length }}
        </span>
        <span class="chip num">{{ locatedCount }}/{{ items.length }} 个节点可定位</span>
      </div>

      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="xMidYMid meet" role="img" aria-label="节点世界分布">
        <g class="world-map__land">
          <path v-for="(path, index) in landPaths" :key="index" :d="path" />
        </g>

        <g class="world-map__nodes">
          <g
            v-for="cluster in clusters"
            :key="cluster.code"
            class="world-map__node"
            @mouseenter="showTooltip(cluster, $event)"
            @mousemove="moveTooltip($event)"
            @mouseleave="hideTooltip"
          >
            <!--
              透明命中区：扩大可交互范围，不必精确瞄准小圆点。
              半径需克制——相邻圆点最近间距可能只有 11px 左右（欧洲区），
              命中区过大时重叠部分会命中后绘制的节点而不是鼠标瞄准的那个。
            -->
            <circle class="world-map__hit" :cx="cluster.x" :cy="cluster.y" :r="9" />
            <circle
              class="world-map__pulse"
              :class="cluster.offline ? 'is-offline' : 'is-online'"
              :cx="cluster.x"
              :cy="cluster.y"
              :r="7"
            />
            <circle
              class="world-map__dot"
              :class="cluster.offline ? 'is-offline' : 'is-online'"
              :cx="cluster.x"
              :cy="cluster.y"
              :r="cluster.entries.length > 1 ? 5.5 : 4.5"
              tabindex="0"
              @click="cluster.entries.length === 1 && openServer(cluster.entries[0].server.id)"
            />
            <text
              v-if="cluster.entries.length > 1"
              class="world-map__count"
              :x="cluster.x"
              :y="cluster.y - 11"
            >
              {{ cluster.entries.length }}
            </text>
          </g>
        </g>
      </svg>

      <div
        v-if="tooltip"
        class="world-map__tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        <div class="world-map__tooltip-head">
          {{ countryFlag(tooltip.cluster.code) }} {{ tooltip.cluster.code }}
          <span class="world-map__tooltip-stat">
            在线 {{ tooltip.cluster.online }} / 离线 {{ tooltip.cluster.offline }}
          </span>
        </div>
        <!-- 单个国家的节点可能很多，限高滚动避免 tooltip 撑满整屏 -->
        <div class="world-map__tooltip-list">
          <button
            v-for="entry in tooltip.cluster.entries"
            :key="entry.server.id"
            type="button"
            class="world-map__tooltip-item"
            @click="openServer(entry.server.id)"
          >
            <i class="dot" :class="entry.online ? 'dot--online' : 'dot--offline'" />
            <span class="world-map__tooltip-name">{{ entry.server.name }}</span>
            <span class="world-map__tooltip-meta num">
              CPU {{ (entry.server.state?.cpu || 0).toFixed(0) }}% ·
              内存 {{ percent(entry.server.state?.mem_used, entry.server.host?.mem_total).toFixed(0) }}%
              <template v-if="entry.online">
                · ↓{{ formatSpeed(entry.server.state?.net_in_speed, 1) }}
              </template>
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.world-map {
  position: relative;
  padding: 14px;
  --map-land: rgba(148, 178, 255, 0.09);
  --map-stroke: rgba(148, 178, 255, 0.2);
}

:global([data-theme="light"]) .world-map {
  --map-land: #e4ecf8;
  --map-stroke: #c6d4e8;
}

.world-map svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.world-map__land path {
  fill: var(--map-land);
  stroke: var(--map-stroke);
  stroke-width: 0.5;
  vector-effect: non-scaling-stroke;
}

.world-map__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 260px;
  color: var(--text-dim);
  font-size: 13px;
}

.world-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.world-map__node {
  cursor: pointer;
}

.world-map__dot {
  transition: r 0.15s ease;
}

.world-map__dot.is-online {
  fill: var(--ok);
  stroke: color-mix(in srgb, var(--ok) 35%, transparent);
  stroke-width: 2;
}

.world-map__dot.is-offline {
  fill: var(--danger);
  stroke: color-mix(in srgb, var(--danger) 35%, transparent);
  stroke-width: 2;
}

.world-map__node:hover .world-map__dot {
  r: 7;
}

/* 透明命中区：扩大可交互范围，避免必须精确瞄准小圆点才能触发 */
.world-map__hit {
  fill: transparent;
  stroke: none;
}

.world-map__pulse {
  opacity: 0.3;
  /* 用 transform 缩放替代动画 r 属性：r 动画每帧都要重绘 SVG，节点多时明显拖慢主线程 */
  transform-box: fill-box;
  transform-origin: center;
  will-change: transform, opacity;
}

.world-map__pulse.is-online {
  fill: var(--ok);
  animation: map-pulse 2.2s ease-out infinite;
}

.world-map__pulse.is-offline {
  fill: transparent;
}

.world-map__count {
  fill: var(--text);
  font-size: 11px;
  font-weight: 700;
  text-anchor: middle;
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 3;
  pointer-events: none;
}

@keyframes map-pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  70%,
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.world-map__tooltip {
  position: absolute;
  z-index: 20;
  min-width: 210px;
  max-width: 320px;
  transform: translate(12px, 12px);
  padding: 9px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--panel-solid) 94%, transparent);
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(12px);
  pointer-events: auto;
}

.world-map__tooltip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  font-weight: 650;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.world-map__tooltip-stat {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-faint);
}

.world-map__tooltip-list {
  max-height: 264px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px;
}

.world-map__tooltip-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 6px;
  border-radius: 7px;
  text-align: left;
  transition: background 0.15s ease;
}

.world-map__tooltip-item:hover {
  background: var(--accent-soft);
}

.world-map__tooltip-name {
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.world-map__tooltip-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
}
</style>
