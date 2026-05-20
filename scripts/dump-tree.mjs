/**
 * Vẽ lại cấu trúc thư mục (cây folder/file) và ghi vào Markdown (ghi đè mỗi lần chạy).
 *
 * Chạy: pnpm run dump:tree
 *        node scripts/dump-tree.mjs
 *        node scripts/dump-tree.mjs .              (từ root chalo-fe, bỏ qua node_modules/.next/...)
 *        node scripts/dump-tree.mjs src --depth=4
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const outFile = path.join(projectRoot, "SRC_TREE.md");

const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
]);

function parseArgs(argv) {
  let rootArg = "src";
  let maxDepth = Infinity;
  for (const a of argv) {
    if (a.startsWith("--depth=")) {
      const n = Number(a.slice("--depth=".length), 10);
      if (Number.isFinite(n) && n >= 0) maxDepth = n;
    } else if (!a.startsWith("-")) {
      rootArg = a;
    }
  }
  return { rootArg, maxDepth };
}

function resolveRoot(rootArg) {
  const abs = path.isAbsolute(rootArg)
    ? rootArg
    : path.join(projectRoot, rootArg);
  if (!fs.existsSync(abs)) {
    console.error("Không thấy thư mục:", abs);
    process.exit(1);
  }
  const st = fs.statSync(abs);
  if (!st.isDirectory()) {
    console.error("Không phải thư mục:", abs);
    process.exit(1);
  }
  return abs;
}

function listChildren(dirPath) {
  const dirs = [];
  const files = [];
  for (const e of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!IGNORE_DIR_NAMES.has(e.name)) dirs.push(e.name);
    } else {
      files.push(e.name);
    }
  }
  dirs.sort((a, b) => a.localeCompare(b));
  files.sort((a, b) => a.localeCompare(b));
  return { dirs, files };
}

/**
 * @param {string} dirAbs
 * @param {string} prefix - ký tự dọc + khoảng trắng cho cấp hiện tại
 * @param {string[]} lines
 * @param {number} depth - độ sâu so với root quét (0 = ngay dưới root)
 * @param {number} maxDepth
 */
function walkTree(dirAbs, prefix, lines, depth, maxDepth) {
  if (depth >= maxDepth) return;
  const { dirs, files } = listChildren(dirAbs);
  const items = [
    ...dirs.map((name) => ({ name, isDir: true })),
    ...files.map((name) => ({ name, isDir: false })),
  ];
  items.forEach((item, i) => {
    const isLast = i === items.length - 1;
    const branch = isLast ? "└── " : "├── ";
    const display = item.isDir ? `${item.name}/` : item.name;
    lines.push(`${prefix}${branch}${display}`);
    if (item.isDir) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      walkTree(path.join(dirAbs, item.name), childPrefix, lines, depth + 1, maxDepth);
    }
  });
}

function buildTree(rootAbs) {
  const rel = path.relative(projectRoot, rootAbs) || ".";
  const label = rel.split(path.sep).join("/") + "/";
  const lines = [label];
  walkTree(rootAbs, "", lines, 0, maxDepth);
  return lines.join("\n");
}

const argv = process.argv.slice(2);
const { rootArg, maxDepth } = parseArgs(argv);
const rootAbs = resolveRoot(rootArg);

const tree = buildTree(rootAbs);
const out =
  "# chalo-fe — cấu trúc thư mục (tree)\n\n" +
  `_Generated: ${new Date().toISOString()}_\n\n` +
  `_Root: \`${path.relative(projectRoot, rootAbs).split(path.sep).join("/") || "."}\` — ` +
  (Number.isFinite(maxDepth) ? `max depth: **${maxDepth}**` : "không giới hạn độ sâu") +
  `._\n\n` +
  "```text\n" +
  tree +
  "\n```\n";

fs.writeFileSync(outFile, out, "utf8");
console.log(`Đã ghi đè ${outFile}`);
