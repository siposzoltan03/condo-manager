"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to a meeting's live-assembly SSE stream. Calls `onEvent` for each
 * server signal (the caller typically refetches authoritative state, e.g.
 * router.refresh()). The browser auto-reconnects EventSource on drop.
 */
export function useAssemblyStream(meetingId: string, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    const es = new EventSource(`/api/voting/meetings/${meetingId}/stream`);
    es.onmessage = () => cb.current();
    return () => es.close();
  }, [meetingId]);
}
