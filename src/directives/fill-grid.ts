import type { Directive } from "vue";

/**
 * v-fill-grid：让网格最后一行的条目自动铺满整行。
 *
 * 背景：`repeat(auto-fill, ...)` 的网格在条目数凑不满一行时会右侧留白，
 * 而 `auto-fit` 只在「总条目数少于列数」时才折叠空轨道，
 * 因此这里按真实列数计算最后一行的补位，把余量平均分配给该行条目。
 */

const pending = new Set<HTMLElement>();
let frame = 0;

function applySpans(el: HTMLElement) {
  const items = Array.from(el.children) as HTMLElement[];
  if (!items.length) return;

  for (const item of items) item.style.gridColumn = "";

  const template = getComputedStyle(el).gridTemplateColumns;
  const columns = template.split(" ").filter(Boolean).length;
  if (columns < 2 || items.length < columns) return;

  const remainder = items.length % columns;
  if (remainder === 0) return;

  const startIndex = items.length - remainder;
  const base = Math.floor(columns / remainder);
  const extra = columns % remainder;

  for (let i = 0; i < remainder; i += 1) {
    const span = base + (i < extra ? 1 : 0);
    if (span > 1) {
      items[startIndex + i].style.gridColumn = `span ${span}`;
    }
  }
}

function schedule(el: HTMLElement) {
  pending.add(el);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    for (const target of pending) applySpans(target);
    pending.clear();
  });
}

const observers = new WeakMap<HTMLElement, ResizeObserver>();

export const vFillGrid: Directive<HTMLElement> = {
  mounted(el) {
    schedule(el);
    const observer = new ResizeObserver(() => schedule(el));
    observer.observe(el);
    observers.set(el, observer);
  },
  updated(el) {
    schedule(el);
  },
  unmounted(el) {
    observers.get(el)?.disconnect();
    observers.delete(el);
    pending.delete(el);
  },
};
