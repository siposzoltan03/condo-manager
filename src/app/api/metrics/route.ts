// Prometheus scrape endpoint. Exposes the app's process metrics in text format.
// Note: reachable on the tailnet via the app's public URL — acceptable for a
// private tailnet; protect or move to a separate port if ever made public.
import { registry } from "@/lib/metrics";

export const dynamic = "force-dynamic"; // never cache; always read live values
export const runtime = "nodejs"; // prom-client needs the Node runtime

export async function GET() {
  const body = await registry.metrics();
  return new Response(body, {
    headers: { "Content-Type": registry.contentType },
  });
}
