import { ref, watch } from "vue";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "aurora-theme";

/** null = 跟随系统；有值 = 用户覆盖（持久化到 localStorage）。 */
let override: ThemeMode | null = readStored();

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

function readStored(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function detectInitial(): ThemeMode {
  return override ?? systemTheme();
}

export const theme = ref<ThemeMode>(detectInitial());

function apply(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#070b14" : "#f4f7fb");
}

apply(theme.value);

/** 跨标签页同步时只更新视图，不回写 localStorage（避免死循环）。 */
let syncing = false;

watch(theme, (mode) => {
  apply(mode);
  if (syncing) return;
  // 目标值与系统偏好一致时删除存储，回到「跟随系统」。
  const next: ThemeMode | null = mode === systemTheme() ? null : mode;
  override = next;
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}, { flush: "sync" });

// 读 matchMedia 必须监听 change；跟随系统时同步刷新视图。
const onSystemChange = () => {
  if (override === null) theme.value = systemTheme();
};
systemDark.addEventListener("change", onSystemChange);

// 另一个标签页切换/清除主题时保持同步。
const onStorageChange = (event: StorageEvent) => {
  if (event.key !== STORAGE_KEY) return;
  const next: ThemeMode | null =
    event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
  override = next;
  syncing = true;
  theme.value = next ?? systemTheme();
  syncing = false;
};
window.addEventListener("storage", onStorageChange);

// HMR 重跑模块会叠加 listener，卸载时清掉，避免 dev 下累积（CJ）
import.meta.hot?.dispose(() => {
  systemDark.removeEventListener("change", onSystemChange);
  window.removeEventListener("storage", onStorageChange);
});

export function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

export function setTheme(mode: ThemeMode) {
  theme.value = mode;
}
