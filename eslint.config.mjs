import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ── Mobile-first Tailwind rule ────────────────────────────────────────────
//
// Flags Tailwind classnames likely to break on phone viewports. Heuristic,
// not perfect — false positives are expected; suppress per-line with a
// // eslint-disable-next-line comment when intentional.
//
// Targets:
//   1. `grid-cols-N` where N ≥ 3 without a sm:/md:/lg:/xl:/2xl: prefix
//      AND no `(sm|md|lg|xl|2xl):grid-cols-` companion in the same string.
//      Mobile-first pattern is `grid-cols-3 sm:grid-cols-4` (3 on phone,
//      scaling up) — that's fine. The bad pattern is a lone `grid-cols-3`
//      with no scaling at all, which would force a 3-col grid on every
//      viewport including a 375 px phone.
//   2. Bare pixel widths over w-96 (384px). e.g. `w-[600px]` is a
//      phone-killer; use max-w-* + flexible widths instead.
//
// Not covered (deliberately, would need AST inspection of JSX children):
//   - `flex-row` on a container with > 3 children lacking mobile fallback.

const NAKED_WIDE_GRID = /(?<![a-z0-9-]):?(?<!(?:sm|md|lg|xl|2xl):)\bgrid-cols-([3-9]|1[0-9])\b/g;
const NAKED_GRID_SIMPLE = /(?:^|\s)grid-cols-([3-9]|1[0-9])(?:\s|$)/g;
const RESPONSIVE_GRID_COMPANION = /(?:sm|md|lg|xl|2xl):grid-cols-[0-9]+/;
const WIDE_PIXEL_WIDTH = /\bw-\[(\d+)px\]/g;
const RESPONSIVE_PREFIXES = ["sm:", "md:", "lg:", "xl:", "2xl:"];

function hasResponsivePrefixBefore(value, matchIndex) {
  for (const prefix of RESPONSIVE_PREFIXES) {
    if (matchIndex >= prefix.length) {
      const slice = value.slice(matchIndex - prefix.length, matchIndex);
      if (slice === prefix) return true;
    }
  }
  return false;
}

const responsiveMobileFirstRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag Tailwind classes that hard-code desktop layouts into phone fallbacks.",
    },
    schema: [],
    messages: {
      nakedWideGrid:
        "`{{cls}}` has no responsive prefix — this becomes a {{cols}}-column grid on phone (375px wide). Prefix with sm:/md:/lg: or change the default to grid-cols-1.",
      widePixelWidth:
        "`w-[{{px}}px]` is wider than most phones (375px). Use max-w-* with a flexible width instead.",
    },
  },
  create(context) {
    function check(value, reportNode) {
      // Mobile-first escape hatch: if the className declares a responsive
      // variant of grid-cols (sm:grid-cols-N etc.) anywhere in the string,
      // the unprefixed grid-cols-N is the phone default — that's the
      // pattern we *want*, not the one we warn about.
      const hasResponsiveCompanion = RESPONSIVE_GRID_COMPANION.test(value);
      let m;
      NAKED_GRID_SIMPLE.lastIndex = 0;
      while ((m = NAKED_GRID_SIMPLE.exec(value)) !== null) {
        const cols = parseInt(m[1], 10);
        if (cols < 3) continue;
        if (hasResponsiveCompanion) continue;
        const matchStart = m.index + m[0].indexOf("grid-cols-");
        if (hasResponsivePrefixBefore(value, matchStart)) continue;
        context.report({
          node: reportNode,
          messageId: "nakedWideGrid",
          data: { cls: `grid-cols-${cols}`, cols: String(cols) },
        });
      }
      WIDE_PIXEL_WIDTH.lastIndex = 0;
      while ((m = WIDE_PIXEL_WIDTH.exec(value)) !== null) {
        const px = parseInt(m[1], 10);
        if (px <= 384) continue;
        context.report({
          node: reportNode,
          messageId: "widePixelWidth",
          data: { px: String(px) },
        });
      }
    }

    function checkAttribute(node) {
      if (node.name?.name !== "className") return;
      const val = node.value;
      if (!val) return;
      // Report on the parent JSXOpeningElement so `eslint-disable-next-line`
      // placed above the `<Tag` line catches the warning. Reporting on the
      // className node itself misses the disable when className is broken
      // onto its own line inside a multi-line JSX element.
      const reportNode = node.parent ?? node;
      if (val.type === "Literal" && typeof val.value === "string") {
        check(val.value, reportNode);
      } else if (val.type === "JSXExpressionContainer") {
        const expr = val.expression;
        if (expr.type === "Literal" && typeof expr.value === "string") {
          check(expr.value, reportNode);
        } else if (expr.type === "TemplateLiteral") {
          for (const q of expr.quasis) {
            check(q.value.cooked ?? q.value.raw, reportNode);
          }
        }
      }
    }

    return { JSXAttribute: checkAttribute };
  },
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "prettier"),
  {
    files: ["src/**/*.tsx", "src/**/*.jsx"],
    plugins: {
      responsive: {
        rules: { "mobile-first": responsiveMobileFirstRule },
      },
    },
    rules: {
      // Promoted from "warn" to "error" 2026-05-18 after the Phase B/C/D
      // sweep brought all violations to zero. Future regressions block
      // the build. Five legit exceptions remain, each marked with an
      // `eslint-disable-next-line responsive/mobile-first` + rationale.
      "responsive/mobile-first": "error",
    },
  },
];

export default eslintConfig;
