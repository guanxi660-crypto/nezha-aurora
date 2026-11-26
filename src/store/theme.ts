import { ref, watch } from "vue";

export type ThemeMode = "light" | "dark";

/** null = 跟随系统；有值 = 用户当前覆盖（不落盘，刷新即归位）。UI 仍是明暗二选一。 */
let override: ThemeMode | null = null;

/** 老浏览器/非浏览器环境可能没有 matchMedia 或会抛错，回退到无副作用 stub（CI） */
function safeMatchMedia(query: string): MediaQueryList {
  try {
    if (typeof window.matchMedia === "function") return window.matchMedia(query);
  } catch {
    /* 回退到 stub */
  }
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  };
}

const systemDark = safeMatchMedia("(prefers-color-scheme: dark)");
const systemTheme = (): ThemeMode => (systemDark.matches ? "dark" : "light");

export const theme = ref<ThemeMode>(systemTheme());

function apply(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#070b14" : "#f4f7fb");
}

apply(theme.value);

/** 手动覆盖跟随系统偏好时立即撤销覆盖（系统偏好变了也自动跟随）。 */
watch(theme, (mode) => {
  apply(mode);
  if (mode === systemTheme()) override = null;
  else override = mode;
}, { flush: "sync" });

// 读 matchMedia 必须监听 change；跟随系统时同步刷新视图。
const onSystemChange = () => {
  if (override === null) theme.value = systemTheme();
};
systemDark.addEventListener("change", onSystemChange);

// HMR 重跑模块会叠加 listener，卸载时清掉，避免 dev 下累积（CJ）
import.meta.hot?.dispose(() => {
  systemDark.removeEventListener("change", onSystemChange);
});

export function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

export function setTheme(mode: ThemeMode) {
  theme.value = mode;
}
