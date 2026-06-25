// Prometheus metrics registry for the app. Single instance per process; the
// globalThis guard keeps dev HMR / repeated imports from re-registering metrics
// (prom-client throws on duplicate registration).
import { Registry, collectDefaultMetrics, Gauge } from "prom-client";

const globalForMetrics = globalThis as unknown as {
  __condoMetricsRegistry?: Registry;
};

export const registry: Registry =
  globalForMetrics.__condoMetricsRegistry ?? new Registry();

if (!globalForMetrics.__condoMetricsRegistry) {
  registry.setDefaultLabels({ app: "condo-manager" });
  // Node process vitals: CPU, RSS/heap, event-loop lag, GC, handles, etc.
  collectDefaultMetrics({ register: registry });
  new Gauge({
    name: "condo_app_info",
    help: "Static app-up indicator (always 1 while the process is alive).",
    registers: [registry],
  }).set(1);
  globalForMetrics.__condoMetricsRegistry = registry;
}
