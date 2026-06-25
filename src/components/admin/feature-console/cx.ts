/**
 * Maps space-free class tokens to their hashed CSS-module names, falling back
 * to the literal token when there's no module entry. Lets the components keep
 * the prototype's semantic class names (cx("eff", "kill")) against a CSS
 * Module. Unknown tokens pass through (e.g. one-off global classes).
 */
export function makeCx(styles: Record<string, string>) {
  return (...tokens: Array<string | false | null | undefined>): string =>
    tokens
      .filter((t): t is string => Boolean(t))
      .map((t) => styles[t] ?? t)
      .join(" ");
}
