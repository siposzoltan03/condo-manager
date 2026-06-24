/**
 * Cleans docs/data-model.dbml so dbdiagram.io can parse it.
 *
 * prisma-dbml-generator preserves Prisma `///` comments as `note: '…'`
 * values, but those values can:
 *
 *   1. span multiple lines (raw newlines inside single-quoted strings), and
 *   2. contain backslash-escaped apostrophes (`\'`),
 *
 * neither of which dbdiagram.io accepts.
 *
 * This script:
 *   - Walks the file char by char, properly tracking string state with
 *     escape-sequence handling.
 *   - Inside each single-quoted string, collapses any newlines + indent
 *     into a single space.
 *   - Inside each single-quoted string, rewrites `\'` to the curly
 *     apostrophe `'` (visually equivalent, but a valid bare char so dbdiagram
 *     never sees a backslash).
 *
 * Run after `npx prisma generate`. Idempotent.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Resolve relative to this script (repo/scripts/) so it works on ANY machine,
// in CI, and in Docker — not just the author's laptop. (A hard-coded absolute
// path here is what made the CI `npm ci` postinstall fail on the Linux runner.)
const PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "data-model.dbml");

if (!existsSync(PATH)) {
  console.error(`No DBML file at ${PATH} — run \`npx prisma generate\` first.`);
  process.exit(1);
}

const content = readFileSync(PATH, "utf8");
const beforeLines = content.split("\n").length;

let out = "";
let inString = false;
let buf = "";

const flushString = () => {
  // 1. unescape \' → ' (curly) so dbdiagram doesn't choke on backslash
  // 2. collapse newlines + leading whitespace
  const cleaned = buf
    .replace(/\\'/g, "’")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  return cleaned;
};

for (let i = 0; i < content.length; i++) {
  const c = content[i];

  if (inString) {
    if (c === "\\" && i + 1 < content.length) {
      // escape sequence — keep both characters in buf
      buf += c + content[i + 1];
      i++;
      continue;
    }
    if (c === "'") {
      // closing quote
      out += flushString() + "'";
      buf = "";
      inString = false;
      continue;
    }
    buf += c;
  } else {
    if (c === "'") {
      inString = true;
      out += "'";
      continue;
    }
    out += c;
  }
}

if (inString) {
  // Unterminated string — flush as-is so we don't lose data, but warn.
  out += buf;
  console.warn("⚠ Unterminated string encountered. Output may be malformed.");
}

writeFileSync(PATH, out, "utf8");
const afterLines = out.split("\n").length;
console.log(
  `Cleaned ${PATH} — ${beforeLines} → ${afterLines} lines ` +
    `(newlines + \\' escapes flattened inside string literals).`,
);
