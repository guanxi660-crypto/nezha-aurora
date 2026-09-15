import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * 开发时把 /api/v1 与实时 WebSocket 代理到本地或远端哪吒面板。
 * 部署到生产时由外层反向代理（Nginx / Caddy）承担同样的转发职责。
 */
const apiTarget = process.env.VITE_API_TARGET || "http://127.0.0.1:8008";
const wsTarget = process.env.VITE_WS_TARGET || apiTarget.replace(/^http/, "ws");

export default defineConfig({
  base: "/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/v1/ws": {
        target: wsTarget,
        ws: true,
        changeOrigin: true,
        secure: process.env.VITE_API_INSECURE !== "1",
      },
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true,
        secure: process.env.VITE_API_INSECURE !== "1",
      },
    },
  },
  build: {
    // 与官方用户前端保持一致的兼容目标，避免旧版 iOS WebKit 白屏
    target: ["es2020", "safari15"],
    cssTarget: ["safari15"],
    assetsDir: "assets",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
});
