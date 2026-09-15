/**
 * 注入面板后台「用户前端自定义代码」里的样式 / 脚本，
 * 行为与官方前端保持一致，保证主题能和面板自定义代码共存。
 */
const MARK = "data-aurora-injected";

function cleanInjected() {
  document.querySelectorAll(`[${MARK}]`).forEach((node) => node.remove());
}

function loadExternalScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute(MARK, "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`外部脚本加载失败：${src}`));
    document.head.appendChild(script);
  });
}

function runInlineScript(content: string) {
  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.textContent = content;
    script.setAttribute(MARK, "true");
    document.body.appendChild(script);
    resolve();
  });
}

function loadStyleElement(element: HTMLElement) {
  return new Promise<void>((resolve, reject) => {
    const href = (element as HTMLLinkElement).href;
    if (href) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute(MARK, "true");
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`样式表加载失败：${href}`));
      document.head.appendChild(link);
    } else {
      const style = document.createElement("style");
      style.textContent = element.textContent || "";
      style.setAttribute(MARK, "true");
      document.head.appendChild(style);
      resolve();
    }
  });
}

export async function injectCustomCode(content: string): Promise<void> {
  if (!content) return;

  const holder = document.createElement("div");
  holder.innerHTML = content;
  cleanInjected();

  for (const node of Array.from(holder.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      document.body.appendChild(
        document.createTextNode(node.textContent || ""),
      );
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const element = node as HTMLElement;
    try {
      switch (element.tagName) {
        case "SCRIPT": {
          const src = (element as HTMLScriptElement).src;
          if (src) await loadExternalScript(src);
          else await runInlineScript(element.textContent || "");
          break;
        }
        case "STYLE":
        case "LINK":
          await loadStyleElement(element);
          break;
        case "META": {
          const meta = element.cloneNode(true) as HTMLElement;
          meta.setAttribute(MARK, "true");
          document.head.appendChild(meta);
          break;
        }
        default:
          element.setAttribute(MARK, "true");
          document.body.appendChild(element);
      }
    } catch (error) {
      console.error("[Aurora] 自定义代码注入失败", error);
    }
  }
}

/**
 * 读取面板自定义代码中设置的 window.* 全局变量
 * 这些变量由后台「用户前端自定义代码」写入，主题需按官方语义消费。
 */
export interface AuroraRuntimeConfig {
  logo?: string;
  desc?: string;
  backgroundImage?: string;
  mobileBackgroundImage?: string;
  links: { name: string; link: string }[];
  forceTheme?: "light" | "dark";
  forceCardInline: boolean;
  forceShowMap: boolean;
  forceShowServices: boolean;
  /** 主题专属配置：window.AuroraConfig = { accentColor: "#38bdf8", ... } */
  accentColor?: string;
  showAdmin?: boolean;
  footerText?: string;
}

type GlobalWithThemeVars = typeof window & {
  CustomLogo?: string;
  CustomDesc?: string;
  CustomBackgroundImage?: string;
  CustomMobileBackgroundImage?: string;
  CustomLinks?: string;
  ForceTheme?: string;
  ForceCardInline?: boolean;
  ForceShowMap?: boolean;
  ForceShowServices?: boolean;
  CustomIllustration?: string;
  AuroraConfig?: Record<string, unknown>;
  NezhaAuroraConfig?: Record<string, unknown>;
};

export function readRuntimeConfig(): AuroraRuntimeConfig {
  const w = window as GlobalWithThemeVars;

  let links: { name: string; link: string }[] = [];
  if (w.CustomLinks) {
    try {
      const parsed = JSON.parse(w.CustomLinks);
      if (Array.isArray(parsed)) {
        links = parsed.filter(
          (item): item is { name: string; link: string } =>
            !!item && typeof item.name === "string" && typeof item.link === "string",
        );
      }
    } catch {
      links = [];
    }
  }

  const plugin = (w.AuroraConfig || w.NezhaAuroraConfig || {}) as Record<string, unknown>;

  return {
    logo: w.CustomLogo || undefined,
    desc: w.CustomDesc || undefined,
    backgroundImage: w.CustomBackgroundImage || undefined,
    mobileBackgroundImage: w.CustomMobileBackgroundImage || undefined,
    links,
    forceTheme: w.ForceTheme === "dark" || w.ForceTheme === "light" ? w.ForceTheme : undefined,
    forceCardInline: w.ForceCardInline === true,
    forceShowMap: w.ForceShowMap === true,
    forceShowServices: w.ForceShowServices === true,
    accentColor: typeof plugin.accentColor === "string" ? plugin.accentColor : undefined,
    // 默认展示「进入管理面板」入口，需要隐藏时在自定义代码里设置 showAdmin: false
    showAdmin: plugin.showAdmin !== false,
    footerText: typeof plugin.footerText === "string" ? plugin.footerText : undefined,
  };
}
