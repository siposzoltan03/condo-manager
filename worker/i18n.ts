import fs from "node:fs";
import path from "node:path";

/**
 * Worker-side i18n loader.
 *
 * The main app reads translations through `next-intl`, which is tied to
 * a Next.js request. Workers don't have a request, so we read the JSON
 * files directly. Caching is per-locale + per-process — files are small
 * (~150KB) so this is essentially free.
 *
 * `t(key, params)` accepts a dotted path and substitutes `{name}` style
 * placeholders. Unknown keys return the path itself, mirroring
 * next-intl's behaviour and making missing translations easy to spot.
 */

type Dict = Record<string, unknown>;

const cache = new Map<string, Dict>();

function loadDict(locale: string): Dict {
  const cached = cache.get(locale);
  if (cached) return cached;
  const fallback = locale === "hu" ? null : "hu";
  const filePath = path.resolve(
    process.cwd(),
    "src/i18n",
    `${locale}.json`,
  );
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const dict = JSON.parse(raw) as Dict;
    cache.set(locale, dict);
    return dict;
  } catch {
    if (fallback) return loadDict(fallback);
    return {};
  }
}

function lookup(dict: Dict, dottedKey: string): string | undefined {
  let node: unknown = dict;
  for (const part of dottedKey.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

export function workerT(
  locale: string,
  key: string,
  params?: Record<string, string>,
): string {
  const primary = lookup(loadDict(locale), key);
  if (primary !== undefined) return interpolate(primary, params);
  // Fall through to Hungarian when the user's preferred locale lacks the key.
  const fallback = lookup(loadDict("hu"), key);
  return interpolate(fallback ?? key, params);
}
