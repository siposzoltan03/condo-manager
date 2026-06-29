import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import {
  resolveBoardAccess,
  resolveContractorAccess,
  readThread,
  appendMessage,
  findPublicationPublisher,
  findPublicationTitle,
  messageFromContractor,
  messageFromBoard,
  type ThreadAccess,
} from "@/lib/marketplace";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ publicationId: string; bidderId: string }>;
}

/**
 * Both sides of the marketplace can read/write a thread:
 *   - Condo session (board+ in the same building) → BOARD side
 *   - Contractor session whose orgId matches `bidderId` → CONTRACTOR side
 *
 * We resolve which side at request time from the JWT `kind` claim.
 */
async function resolveAccess(
  publicationId: string,
  bidderId: string,
): Promise<
  | { ok: true; access: ThreadAccess; viewerId: string }
  | { ok: false; status: number; error: string }
> {
  const session = await auth();
  const u = session?.user;
  if (!u) return { ok: false, status: 401, error: "Unauthorized" };

  if (u.kind === "contractor") {
    if (u.contractorOrgId !== bidderId) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    const access = await resolveContractorAccess(publicationId, bidderId);
    if (!access) return { ok: false, status: 404, error: "Not found" };
    return { ok: true, access, viewerId: u.id };
  }

  // Condo side — must be board+ in the publication's building.
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    if (!allows(ctx, "ticket.assign")) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    const access = await resolveBoardAccess(
      publicationId,
      bidderId,
      buildingId,
    );
    if (!access) return { ok: false, status: 404, error: "Not found" };
    return { ok: true, access, viewerId: userId };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
}

export async function GET(_request: Request, ctx: RouteContext) {
  const { publicationId, bidderId } = await ctx.params;
  const r = await resolveAccess(publicationId, bidderId);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  const messages = await readThread(r.access, r.viewerId);
  return NextResponse.json({
    messages,
    access: {
      canWrite: r.access.canWrite,
      side: r.access.side,
      publicationStatus: r.access.publicationStatus,
      isWinningThread: r.access.isWinningThread,
    },
  });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { publicationId, bidderId } = await ctx.params;
  const r = await resolveAccess(publicationId, bidderId);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  if (!r.access.canWrite) {
    return NextResponse.json(
      { error: "Thread is read-only" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { body?: string }
    | null;
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  try {
    const created = await appendMessage(r.access, r.viewerId, body.body);

    // Ping the other party through notify(). Each side has its own
    // recipient column (`userId` for the board, `contractorUserId` for
    // the contractor), so the discriminator is just `access.side`.
    if (r.access.side === "CONTRACTOR") {
      const pub = await findPublicationPublisher(r.access.publicationId);
      if (pub) {
        messageFromContractor({
          publicationId: r.access.publicationId,
          publishedById: pub.publishedById,
          scrubbedTitle: pub.scrubbedTitle,
        }).catch((err) =>
          console.error("Marketplace message notify failed:", err),
        );
      }
    } else {
      const pub = await findPublicationTitle(r.access.publicationId);
      if (pub) {
        messageFromBoard({
          publicationId: r.access.publicationId,
          bidderOrgId: r.access.bidderId,
          scrubbedTitle: pub.scrubbedTitle,
        }).catch((err) =>
          console.error("Marketplace board-message notify failed:", err),
        );
      }
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 400 },
    );
  }
}
