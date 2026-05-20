/**
 * Ghi ra file Markdown toàn bộ nội dung các file thay đổi theo Git:
 *
 * 1) Một commit (mặc định HEAD)
 *    pnpm run dump:git
 *    pnpm run dump:git -- abc1234
 *
 * 2) Chưa commit — file đang staged
 *    pnpm run dump:git:staged
 *
 * Tuỳ chọn: pnpm run dump:git -- HEAD --out ./dump.md
 *
 * Mỗi lần chạy: ghi đè hoàn toàn file output.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const defaultOut = path.join(projectRoot, "GIT_COMMIT_CHANGES.md");

function git(args, opts = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    cwd: projectRoot,
    maxBuffer: 50 * 1024 * 1024,
    ...opts,
  });
}

function parseArgs(argv) {
  let staged = false;
  let commit = "HEAD";
  let out = defaultOut;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--staged") staged = true;
    else if (a === "--out" && argv[i + 1]) out = path.resolve(projectRoot, argv[++i]);
    else if (!a.startsWith("-") && !staged) commit = a;
  }
  return { staged, commit, out };
}

function isBinaryString(s) {
  if (s.length > 2 * 1024 * 1024) return true;
  const slice = s.slice(0, 8000);
  for (let i = 0; i < slice.length; i++) {
    if (slice.charCodeAt(i) === 0) return true;
  }
  return false;
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/** @returns {{ status: string, path: string, pathTo?: string }[]} */
function listCommitFiles(fullHash) {
  const raw = git(["diff-tree", "--no-commit-id", "--name-status", "-r", fullHash]).trim();
  if (!raw) return [];
  const rows = [];
  for (const line of raw.split("\n")) {
    const parts = line.split("\t");
    const status = parts[0];
    if (!status) continue;
    if (status.startsWith("R")) {
      rows.push({ status: "R", path: parts[1], pathTo: parts[2] });
    } else {
      rows.push({ status: status.charAt(0), path: parts[1] });
    }
  }
  return rows;
}

function listStagedFiles() {
  const raw = git(["diff", "--cached", "--name-only", "-z"]);
  if (!raw) return [];
  return raw.split("\0").filter(Boolean).map((p) => ({ status: "S", path: p }));
}

function extToLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "ts";
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  return "";
}

function main() {
  const argv = process.argv.slice(2);
  const { staged, commit: commitRef, out } = parseArgs(argv);

  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    console.error("Không phải Git repository.");
    process.exit(1);
  }

  let title;
  const metaLines = [];
  /** @type {{ status: string, path: string, pathTo?: string }[]} */
  let entries;
  /** @type {string | null} */
  let commitFull = null;

  if (staged) {
    title = "# Git — các file đang **staged** (chưa commit)\n\n";
    const head = git(["rev-parse", "HEAD"]).trim();
    metaLines.push("- **Kiểu:** staged (index)");
    metaLines.push(`- **HEAD:** \`${head}\``);
    entries = listStagedFiles();
  } else {
    commitFull = git(["rev-parse", commitRef]).trim();
    const subj = git(["log", "-1", "--pretty=format:%s", commitFull]).trim();
    const date = git(["log", "-1", "--pretty=format:%ci", commitFull]).trim();
    title = `# Git — thay đổi trong commit \`${commitFull.slice(0, 7)}\`\n\n`;
    metaLines.push(`- **Commit:** \`${commitFull}\``);
    metaLines.push(`- **Subject:** ${subj}`);
    metaLines.push(`- **Date:** ${date}`);
    entries = listCommitFiles(commitFull);
  }

  const gen = new Date().toISOString();
  let md =
    title +
    `_Generated: ${gen}_\n\n` +
    metaLines.join("\n") +
    "\n\n---\n\n";

  if (entries.length === 0) {
    md += "_Không có file nào._\n";
    fs.writeFileSync(out, md, "utf8");
    console.log(`Đã ghi đè ${out} (0 file).`);
    return;
  }

  for (const row of entries) {
    const displayPath = row.pathTo ?? row.path;
    md += `<!-- file: ${displayPath} | status: ${row.status}${row.pathTo ? ` | rename: ${row.path} → ${row.pathTo}` : ""} -->\n\n`;

    let body = null;

    if (staged) {
      body = tryGit(["show", `:${row.path}`]);
    } else {
      const pathInCommit = row.pathTo ?? row.path;
      body = tryGit(["show", `${commitFull}:${pathInCommit}`]);

      if (body === null && row.status === "D") {
        let parent;
        try {
          parent = git(["rev-parse", `${commitFull}^`]).trim();
        } catch {
          parent = null;
        }
        if (parent) {
          const prev = tryGit(["show", `${parent}:${row.path}`]);
          if (prev !== null) {
            md += `_File xóa trong commit — bản trước tại parent \`${parent.slice(0, 7)}\`:_\n\n`;
            body = prev;
          }
        }
        if (body === null) {
          md += `_File đã xóa; không đọc được nội dung tại parent._\n\n`;
          continue;
        }
      }

      if (body === null) {
        md += `_Không đọc được nội dung (binary hoặc không tồn tại)._ \n\n`;
        continue;
      }
    }

    if (body === null) {
      md += "_Không đọc được nội dung._\n\n";
      continue;
    }

    if (isBinaryString(body)) {
      md += "```\n(binary — bỏ qua nội dung)\n```\n\n";
      continue;
    }

    const lang = extToLang(displayPath);
    md += "```" + lang + "\n" + body.replace(/\r\n/g, "\n") + "\n```\n\n";
  }

  fs.writeFileSync(out, md, "utf8");
  console.log(`Đã ghi đè ${out} (${entries.length} file).`);
}

main();
