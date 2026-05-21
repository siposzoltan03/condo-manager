"use client";

import { useEffect, useRef } from "react";

/**
 * Mirror of the server-side CommEvent type. Kept inline so the client
 * doesn't import "server-only" code.
 */
export type CommStreamEvent =
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

interface Options {
  onEvent: (event: CommStreamEvent) => void;
  /** Called when the connection (re)opens. Used to flush stale state. */
  onOpen?: () => void;
}

/**
 * Subscribe to /api/communication/stream. The browser's native EventSource
 * already handles reconnection. We just wire its `onmessage` to the caller.
 */
export function useCommunicationStream({ onEvent, onOpen }: Options): void {
  // Keep the latest callbacks in refs so we don't re-open the EventSource
  // every render — the URL is fixed and the source is expensive to recreate.
  const onEventRef = useRef(onEvent);
  const onOpenRef = useRef(onOpen);
  onEventRef.current = onEvent;
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/api/communication/stream");

    es.onopen = () => {
      onOpenRef.current?.();
    };
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as CommStreamEvent;
        onEventRef.current(event);
      } catch {
        // ignore malformed payloads
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };

    return () => {
      es.close();
    };
  }, []);
}
