/**
 * 把 vite 构建产物打包成哪吒主题发布包 dist.zip
 *
 * 哪吒（V2）的主题下载脚本要求：
 *   1. release 附件必须叫 dist.zip
 *   2. zip 根目录下必须保留 dist/ 这一层
 *   3. 不能出现以 "_" 或 "." 开头的路径段（Go Embed 会忽略它们）
 */
import { deflateRawSync } from "node:zlib";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const archive = "dist.zip";
const outputRoot = "dist";

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function collect(directory, relative = outputRoot) {
  const entries = [{ name: `${relative}/`, directory: true }];
  for (const child of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (child.name === ".DS_Store" || child.name === ".gitkeep") continue;
    const diskPath = path.join(directory, child.name);
    const zipPath = `${relative}/${child.name}`;
    if (child.isSymbolicLink() || lstatSync(diskPath).isSymbolicLink()) {
      throw new Error(`发布目录中不允许符号链接：${diskPath}`);
    }
    if (child.isDirectory()) entries.push(...collect(diskPath, zipPath));
    else if (child.isFile()) entries.push({ name: zipPath, directory: false, diskPath });
  }
  return entries;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const source = entry.directory ? Buffer.alloc(0) : readFileSync(entry.diskPath);
    const compressed = entry.directory ? source : deflateRawSync(source, { level: 9 });
    const checksum = crc32(source);
    const method = entry.directory ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12); // 固定时间戳，保证可复现
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.directory ? 0x41ed0010 : 0x81a40000, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

if (!existsSync(`${outputRoot}/index.html`)) {
  console.error("缺少 dist/index.html，请先执行 npm run build。");
  process.exit(1);
}

try {
  if (existsSync(archive)) rmSync(archive);
  const entries = collect(outputRoot);

  const hidden = entries.find((entry) =>
    entry.name.split("/").some((segment) => segment.startsWith("_") || segment.startsWith(".")),
  );
  if (hidden) {
    throw new Error(`发布包包含无法被 Go Embed 嵌入的路径：${hidden.name}`);
  }

  writeFileSync(archive, createZip(entries));
  console.log(`已生成 ${archive}（${entries.length} 个条目，顶层目录为 dist/）。`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
