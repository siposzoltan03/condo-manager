import fs from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Embed Manrope so PDF reports render the full Hungarian alphabet
 * (ű/ő/etc — Latin Extended-A glyphs are missing from the built-in
 * Helvetica). Files live under `src/reports/lib/fonts/` and ship with
 * the build.
 *
 * Two notes on robustness:
 *
 *   1. We pass each TTF as a base64 data URL. react-pdf's font loader
 *      decodes the URL and feeds the bytes to `fontkit.create()`,
 *      bypassing its `fontkit.open(path)` branch — that branch is
 *      fragile under Next.js's bundler since `process.cwd()` and
 *      module-relative paths drift at runtime.
 *
 *   2. `Font.register` is push-only on a singleton inside `react-pdf`
 *      (it does not dedupe by family). Under Next.js HMR our module is
 *      reloaded but the singleton persists — so without a guard, every
 *      reload appends another set of sources, and the first one wins
 *      during resolution. We drop the existing family before
 *      registering to keep things deterministic.
 */

const FONTS_DIR = path.resolve(process.cwd(), "src/reports/lib/fonts");

function loadDataUrl(filename: string): string {
  const buf = fs.readFileSync(path.join(FONTS_DIR, filename));
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

export function registerReportFonts(): void {
  // Drop any prior Manrope sources accumulated by HMR before registering.
  const families = Font.getRegisteredFonts() as Record<string, unknown>;
  delete families["Manrope"];

  Font.register({
    family: "Manrope",
    fonts: [
      { src: loadDataUrl("Manrope-Regular.ttf"), fontWeight: 400 },
      { src: loadDataUrl("Manrope-Medium.ttf"), fontWeight: 500 },
      { src: loadDataUrl("Manrope-Bold.ttf"), fontWeight: 700 },
    ],
  });
}
