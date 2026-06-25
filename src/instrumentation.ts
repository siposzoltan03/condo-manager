// Next.js calls register() once at server startup. Initialize metrics in the
// Node runtime only — prom-client can't run on the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/metrics");
  }
}
