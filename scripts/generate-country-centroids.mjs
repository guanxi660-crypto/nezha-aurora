/**
 * 生成国家/地区中心坐标表（世界地图打点用）
 *
 * 数据源：world-countries（开发依赖），仅取 cca2 与 latlng 两个字段，
 * 产出体积极小的 src/utils/country-centroids.ts。
 *
 * 用法：node scripts/generate-country-centroids.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import countries from "world-countries";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "src", "utils", "country-centroids.ts");

/** 补几个常用地区代码：world-countries 使用 cca2，港澳台可用，另补常见别名 */
const EXTRA = {
  XK: [42.6, 20.9],
};

const map = {};
for (const country of countries) {
  const cca2 = (country.cca2 || "").toUpperCase();
  const latlng = country.latlng;
  if (!/^[A-Z]{2}$/.test(cca2) || !Array.isArray(latlng) || latlng.length < 2) continue;
  const [lat, lng] = latlng;
  if (typeof lat !== "number" || typeof lng !== "number") continue;
  map[cca2] = [Number(lat.toFixed(4)), Number(lng.toFixed(4))];
}

for (const [code, value] of Object.entries(EXTRA)) {
  if (!map[code]) map[code] = value;
}

const codes = Object.keys(map).sort();

const output = [
  "/**",
  " * 国家/地区中心坐标：ISO 3166-1 alpha-2 -> [纬度, 经度]",
  " * 由 scripts/generate-country-centroids.mjs 生成，请勿手工修改。",
  " */",
  "export const countryCentroids: Record<string, [number, number]> = {",
  ...codes.map((code) => `  ${code}: [${map[code][0]}, ${map[code][1]}],`),
  "};",
  "",
  "/** 取不到坐标时的占位（0, 0 会在绘制时被丢弃） */",
  "export function centroidOf(code?: string): [number, number] | null {",
  "  if (!code) return null;",
  "  return countryCentroids[code.trim().toUpperCase()] || null;",
  "}",
  "",
].join("\n");

fs.writeFileSync(TARGET, output, "utf8");
console.log(`已生成 ${path.relative(ROOT, TARGET)}，共 ${codes.length} 个国家/地区。`);
