import "server-only";
import { EventEmitter } from "node:events";

/**
 * Real-time pub/sub bus for live assembly mode (Közgyűlés mód), scoped per
 * meeting. Mirrors communication-bus.ts: in-memory EventEmitter for
 * dev/single-instance; swap for Redis pub/sub or Pusher in multi-instance
 * prod without touching callsites.
 *
 * Events are deliberately thin signals — the presenter and companion clients
 * refetch the authoritative state (point, tally, quorum) on receipt, so no
 * privileged data flows over the stream.
 */
export type AssemblyEvent =
  | { type: "session:started"; meetingId: string }
  | { type: "session:point"; meetingId: string; index: number }
  | { type: "session:voteOpened"; meetingId: string; voteId: string }
  | { type: "session:voteClosed"; meetingId: string; voteId: string }
  | { type: "session:tally"; meetingId: string; voteId: string }
  | { type: "session:quorum"; meetingId: string }
  | { type: "session:question"; meetingId: string }
  | { type: "session:ended"; meetingId: string };

interface BusGlobal {
  __assemblyBus?: EventEmitter;
}

const g = globalThis as unknown as BusGlobal;
const bus = g.__assemblyBus ?? new EventEmitter();
bus.setMaxListeners(0);
if (process.env.NODE_ENV !== "production") g.__assemblyBus = bus;

export function publishToMeeting(meetingId: string, event: AssemblyEvent): void {
  bus.emit(meetingId, event);
}

export function subscribeMeeting(
  meetingId: string,
  cb: (event: AssemblyEvent) => void,
): () => void {
  bus.on(meetingId, cb);
  return () => bus.off(meetingId, cb);
}
