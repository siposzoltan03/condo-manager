/**
 * Neutralize `server-only` / `client-only` for the worker process.
 *
 * Many shared libs the worker reuses (audit, notifications, report data
 * builders, …) start with `import "server-only"`. That package is a Next.js
 * client-boundary guard: outside a React Server build it throws
 *   "This module cannot be imported from a Client Component module."
 * The BullMQ worker is a plain Node/tsx process — not an RSC context — so the
 * guard fires and crashes the whole worker at startup, leaving every queue
 * (reports, notifications, voting, scheduled) unconsumed.
 *
 * The guard is meaningless here (there is no client bundle), so we intercept
 * the module load and return an empty module. This MUST be imported before any
 * app code so the patch is installed first — see worker/index.ts.
 */
import Module from "module";

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;

const mod = Module as unknown as { _load: Loader };
const original = mod._load;

mod._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only" || request === "client-only") {
    return {};
  }
  return original.call(this, request, parent, isMain);
};
