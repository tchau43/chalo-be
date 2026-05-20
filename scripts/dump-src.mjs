/**
 * Gộp toàn bộ mã trong `src/` vào một file Markdown (ghi đè mỗi lần chạy).
 *
 * Chạy: pnpm run dump:src   (hoặc: node scripts/dump-src.mjs)
 *
 * Mỗi lần chạy: đọc lại cây thư mục src → tạo nội dung mới → ghi đè SRC_CODE_DUMP.md
 * (writeFileSync thay thế toàn bộ file, không append).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const outFile = path.join(projectRoot, "SRC_CODE_DUMP.md");

const skipExt = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) {
    console.error("Không thấy thư mục:", dir);
    process.exit(1);
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (!skipExt.has(ext)) acc.push(p);
    }
  }
  return acc;
}

const files = walk(srcRoot).sort((a, b) => a.localeCompare(b));

let out =
  "# chalo-fe — snapshot toàn bộ mã nguồn trong `src/`\n\n" +
  `_Generated: ${new Date().toISOString()}_\n\n` +
  "_File này được tạo / **ghi đè hoàn toàn** bởi `pnpm run dump:src`._\n\n";

for (const fp of files) {
  const relFromChalo = "src/" + path.relative(srcRoot, fp).replace(/\\/g, "/");
  const txt = fs.readFileSync(fp, "utf8");
  const ext = path.extname(fp).toLowerCase();
  const lang =
    ext === ".tsx"
      ? "tsx"
      : ext === ".ts"
        ? "ts"
        : ext === ".css"
          ? "css"
          : ext === ".json"
            ? "json"
            : "";
  out += `<!-- file: ${relFromChalo} -->\n\n`;
  out += "```" + lang + "\n" + txt + "\n```\n\n";
}

fs.writeFileSync(outFile, out, "utf8");
console.log(`Đã ghi đè ${outFile} (${files.length} file).`);
