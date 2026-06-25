import "server-only";
import { EventEmitter } from "node:events";

/**
 * Real-time pub/sub bus for the communication module.
 *
 * In dev/single-instance prod: in-memory EventEmitter, scoped per building.
 * For multi-instance prod, swap this for Redis pub/sub or Pusher — every
 * event publisher uses {@link publishToBuilding} and every consumer uses
 * {@link subscribeBuilding}; the implementation can change without touching
 * any callsite.
 */

export type CommEvent =
  | {
      type: "message:new";
      buildingId: string;
      channelId: string;
      messageId: string;
      authorId: string;
      isUrgent?: boolean;
    }
  | {
      type: "message:update";
      buildingId: string;
      channelId: string;
      messageId: string;
      reason: "react" | "vote" | "pin" | "edit";
    }
  | {
      type: "typing";
      buildingId: string;
      channelId: string;
      userId: string;
      userFirstName: string;
      at: number;
    }
  | {
      type: "presence";
      buildingId: string;
      userId: string;
      online: boolean;
    };

interface BusGlobal {
  __commBus?: EventEmitter;
  __commPresence?: Map<string, number>; // userId → last-seen epoch ms
}

const g = globalThis as unknown as BusGlobal;
const bus = g.__commBus ?? new EventEmitter();
bus.setMaxListeners(0);
if (process.env.NODE_ENV !== "production") g.__commBus = bus;

const presence = g.__commPresence ?? new Map<string, number>();
if (process.env.NODE_ENV !== "production") g.__commPresence = presence;

export function publishToBuilding(buildingId: string, event: CommEvent): void {
  bus.emit(buildingId, event);
}

export function subscribeBuilding(
  buildingId: string,
  cb: (event: CommEvent) => void,
): () => void {
  bus.on(buildingId, cb);
  return () => bus.off(buildingId, cb);
}

const PRESENCE_WINDOW_MS = 60_000;

export function markPresent(userId: string): void {
  presence.set(userId, Date.now());
}

export function getOnlineUserIds(userIds: string[]): Set<string> {
  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  const set = new Set<string>();
  for (const uid of userIds) {
    const t = presence.get(uid);
    if (t && t >= cutoff) set.add(uid);
  }
  return set;
}
