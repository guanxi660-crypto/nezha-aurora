import { ref, watch } from "vue";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "aurora-theme";

function detectInitial(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const theme = ref<ThemeMode>(detectInitial());

function apply(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#070b14" : "#f4f7fb");
}

apply(theme.value);

watch(theme, (mode) => {
  apply(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
});

export function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

export function setTheme(mode: ThemeMode) {
  theme.value = mode;
}
