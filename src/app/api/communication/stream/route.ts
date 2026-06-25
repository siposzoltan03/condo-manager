import { NextRequest } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import {
  subscribeBuilding,
  markPresent,
  publishToBuilding,
  type CommEvent,
} from "@/lib/communication-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream — one connection per browser tab.
 *
 * Subscribes to the bus for the user's current building and forwards
 * events to the client. Sends a keep-alive comment every 25s to defeat
 * proxy idle timeouts. The client filters / acts on events client-side.
 */
export async function GET(_request: NextRequest) {
  const { userId, buildingId } = await requireBuildingContext();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: CommEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Initial hello so the client knows the stream is live.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      // Track this user as present + announce to other building members.
      markPresent(userId);
      publishToBuilding(buildingId, {
        type: "presence",
        buildingId,
        userId,
        online: true,
      });

      unsubscribe = subscribeBuilding(buildingId, (event) => {
        try {
          send(event);
        } catch {
          // controller may be closed during teardown; swallow.
        }
      });

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
          markPresent(userId);
        } catch {
          // ignore
        }
      }, 25_000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
