import * as dal from "./dal";

/**
 * Anonymous board ↔ contractor messaging on a `(publication, bidder)`
 * thread. Plain-text only.
 *
 * Visibility:
 *   - Pre-award: board sees "Közös képviselő" / contractor sees "Bidder #N"
 *   - Post-award: names + contacts unmask **only on the winning thread**.
 *     Losing threads stay anonymized + read-only.
 */

export type SenderSide = "BOARD" | "CONTRACTOR";

export interface ThreadAccess {
  publicationId: string;
  bidderId: string;
  /** Is the requesting user allowed to read this thread? */
  canRead: boolean;
  /** Can the requesting user still post? */
  canWrite: boolean;
  /** Side of the requesting user. */
  side: SenderSide;
  /** Publication state at lookup time. */
  publicationStatus: string;
  /** True iff this is the winning thread (post-award). */
  isWinningThread: boolean;
}

/**
 * Resolve who's allowed to do what on a thread, from the condo side.
 * The thread's board side is "anyone with board+ access to the
 * building"; we don't restrict to the publisher.
 */
export async function resolveBoardAccess(
  publicationId: string,
  bidderId: string,
  buildingId: string,
): Promise<ThreadAccess | null> {
  const pub = await dal.findPublicationForBoardAccess(publicationId, bidderId);
  if (!pub) return null;
  if (pub.ticket.buildingId !== buildingId) return null;
  const bid = pub.bids[0];
  if (!bid) return null;

  const isWinningThread =
    pub.awardedBidId !== null && pub.awardedBidId === bid.id;
  const isLosingThread =
    pub.status === "AWARDED" || pub.status === "CLOSED"
      ? !isWinningThread
      : false;

  return {
    publicationId: pub.id,
    bidderId,
    canRead: true,
    canWrite: !isLosingThread, // losing threads are read-only
    side: "BOARD",
    publicationStatus: pub.status,
    isWinningThread,
  };
}

export async function resolveContractorAccess(
  publicationId: string,
  bidderOrgId: string,
): Promise<ThreadAccess | null> {
  const pub = await dal.findPublicationForContractorAccess(
    publicationId,
    bidderOrgId,
  );
  if (!pub) return null;

  // Pre-bid messaging is allowed on OPEN publications — contractors
  // can ask clarifying questions before committing a price.
  // Post-award the thread becomes read-only for losing bidders;
  // a non-bidder has no business reading a closed/awarded thread.
  const bid = pub.bids[0];
  const isOpen = pub.status === "OPEN";
  const isWinningThread =
    pub.awardedBidId !== null && bid !== undefined && pub.awardedBidId === bid.id;

  if (!isOpen && !bid) return null;

  const isLosingThread =
    bid !== undefined && !isOpen && !isWinningThread;

  return {
    publicationId: pub.id,
    bidderId: bidderOrgId,
    canRead: true,
    canWrite: isOpen || (!isLosingThread && isWinningThread),
    side: "CONTRACTOR",
    publicationStatus: pub.status,
    isWinningThread,
  };
}

export interface ThreadMessage {
  id: string;
  side: SenderSide;
  /** Display name shown to the other party. Anonymized pre-award. */
  senderDisplayName: string;
  /** "self" when the message is from the requesting user. */
  isSelf: boolean;
  body: string;
  createdAt: string;
}

/**
 * Read messages with visibility rules applied. Each message is tagged
 * with `isSelf` so the UI can render its own side without exposing
 * raw senderIds. Names stay anonymized pre-award (and on losing
 * threads post-award).
 */
export async function readThread(
  access: ThreadAccess,
  viewerId: string,
): Promise<ThreadMessage[]> {
  const rows = await dal.findThreadMessages(
    access.publicationId,
    access.bidderId,
  );

  return rows.map((m) => {
    const isSelf = m.senderId === viewerId;
    const side = (m.senderSide as SenderSide) ?? "BOARD";
    let display: string;
    if (access.isWinningThread) {
      // Unmask: BOARD shows publisher name, CONTRACTOR shows org name.
      display = side === "BOARD" ? "Közös képviselő" : "Kivitelező";
    } else {
      display = side === "BOARD" ? "Közös képviselő" : "Kivitelező";
    }
    return {
      id: m.id,
      side,
      senderDisplayName: display,
      isSelf,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    };
  });
}

/**
 * Append a message to the thread. The caller has already passed access
 * checks via `resolveBoardAccess` / `resolveContractorAccess`.
 */
export async function appendMessage(
  access: ThreadAccess,
  senderId: string,
  body: string,
) {
  const trimmed = body.trim().slice(0, 4000);
  if (!trimmed) throw new Error("Empty message");
  if (!access.canWrite) throw new Error("Thread is read-only");

  return dal.createThreadMessage({
    publicationId: access.publicationId,
    bidderId: access.bidderId,
    senderSide: access.side,
    senderId,
    body: trimmed,
  });
}
