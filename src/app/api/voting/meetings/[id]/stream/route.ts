import { NextRequest } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeMeeting, type AssemblyEvent } from "@/lib/assembly-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * SSE stream for a live assembly — one connection per presenter/companion tab.
 * Forwards meeting-scoped events; the client refetches authoritative state on
 * each signal. Keep-alive every 25s. Anyone in the building may subscribe
 * (read-only follow); mutations have their own board-gated endpoints.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { buildingId } = await requireBuildingContext();
  const { id } = await ctx.params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { buildingId: true },
  });
  if (!meeting || meeting.buildingId !== buildingId) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: AssemblyEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller closed during teardown — swallow.
        }
      }
      controller.enqueue(encoder.encode(`: connected\n\n`));
      unsubscribe = subscribeMeeting(id, send);
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ka\n\n`));
        } catch {
          /* ignore */
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
