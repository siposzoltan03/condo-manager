# Real-Time Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up real-time infrastructure that the designs assume but no code implements: live voting quorum, live message delivery, presence dots, typing indicators, unread badge counts, web push. The designs (App - Voting.html, App - Communication.html, sidebar everywhere) treat these as default; today the app polls or shows static numbers.

**Architecture:** Hybrid SSE + WebSocket on top of Redis pub/sub. SSE handles the easy 80% (one-way fan-out: notifications, vote tally, unread counts) directly through a Next.js route handler. A separate `ws` worker process handles bidirectional cases (typing indicators, presence beacons). All state lives in Redis; socket workers stay stateless.

**Tech Stack:** Next.js 15 (route handlers for SSE), `ioredis` (already a dep), `ws` (new), `web-push` (already a dep), BullMQ worker (existing), NextAuth v5 JWT.

**Spec source:** Audit findings dated 2026-04-28. Cross-references: `docs/plans/2026-04-27-roles-legal-alignment.md` (notice § 33/A delivery proof — SSE/WS are NOT a legal substitute for email).

**Non-goals:**
- SMS delivery (separate provider plan).
- Email delivery hardening including § 33/A delivery proof (separate plan).
- Replacing the BullMQ queues — real-time is additive, not a replacement.
- Real-time collaborative editing — no module needs it.
- Server-side observability of every connected client — minimum viable telemetry only.

---

## File Structure — What Changes

```
src/
├── lib/
│   ├── realtime-publisher.ts          # NEW: publishes events to Redis channels
│   ├── realtime-channels.ts           # NEW: typed channel names
│   └── realtime-auth.ts               # NEW: validates JWT for socket upgrade
├── app/
│   └── api/
│       └── realtime/
│           └── stream/route.ts        # NEW: SSE endpoint, one connection per user
├── hooks/
│   ├── use-realtime-stream.ts         # NEW: client-side EventSource wrapper
│   ├── use-channel-presence.ts        # NEW (Phase 4): WS-backed presence
│   └── use-channel-unread.ts          # NEW: SSE-backed unread counts per channel
realtime/                              # NEW directory — separate Node process
├── index.ts                           # WebSocket server (Phase 4)
└── handlers/
    ├── presence.ts
    └── typing.ts
worker/
└── jobs/
    └── notification-fanout.ts         # NEW (Phase 2): publishes Notification creates to Redis
public/
└── sw.js                              # NEW (Phase 5): service worker for web push
.env.example                           # MODIFY: VAPID keys, realtime worker port
docker-compose.yml                     # MODIFY (Phase 4): add realtime service
```

No Prisma schema changes — `Notification` and `PushSubscription` already exist (`prisma/schema.prisma:340,858`).

---

## Phase 1: SSE foundation

**Goal:** A working `/api/realtime/stream` endpoint that authenticates the caller, opens an EventSource per `(userId, activeBuildingId)`, subscribes to relevant Redis channels, and forwards messages. No features yet — just the pipe.

- [ ] **Step 1: Add `ws` dep** (used in Phase 4) and confirm `ioredis` and `web-push` are present.

- [ ] **Step 2: Create `src/lib/realtime-channels.ts`**:
  ```ts
  export const channels = {
    notifications: (userId: string) => `notifications:${userId}`,
    vote:          (voteId: string)  => `vote:${voteId}`,
    presence:      (buildingId: string) => `presence:${buildingId}`,
    conversation:  (id: string)      => `conversation:${id}`,
    channelUnread: (userId: string)  => `unread:${userId}`,
  } as const;
  ```

- [ ] **Step 3: Create `src/lib/realtime-publisher.ts`** with `publish(channel: string, event: { type: string; data: unknown; id?: string })`. Wraps `ioredis.publish` plus JSON encoding. Always sets `id` to a monotonic counter for `lastEventId` replay.

- [ ] **Step 4: Create `src/app/api/realtime/stream/route.ts`** as a streaming `GET` handler:
  - Validate NextAuth session (reject 401 if absent).
  - Derive `(userId, activeBuildingId)` from session.
  - Open `text/event-stream` response with no buffering (`Cache-Control: no-cache, X-Accel-Buffering: no`).
  - Subscribe to `channels.notifications(userId)` and `channels.channelUnread(userId)`. (Voting and conversation channels are subscribed dynamically by the client emitting "subscribe" via a separate route in Phase 3.)
  - Forward each Redis message as `id: <id>\nevent: <type>\ndata: <json>\n\n`.
  - Honor `Last-Event-ID` header for replay. Replay strategy: keep the last 50 events per user channel in a Redis list with TTL 1 h.
  - On client disconnect, unsubscribe and close.

- [ ] **Step 5: Create `src/hooks/use-realtime-stream.ts`**:
  - Opens an `EventSource` to `/api/realtime/stream`.
  - Exposes a `subscribe(eventType, handler)` API.
  - Reconnects on close with exponential backoff (1s, 2s, 4s, max 30s).
  - Resumes via `lastEventId` after reconnect.

- [ ] **Step 6: Deployment caveat in the plan**: SSE on serverless platforms with short connection limits (e.g. Vercel hobby ~25 s) will not work. The condo-manager runs as Docker + nginx (`Dockerfile`, `nginx/`) — confirm `proxy_read_timeout` is set to at least 600 s in the nginx config.

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "feat(realtime): phase 1 — SSE foundation, hook, JWT auth, replay"
  ```

---

## Phase 2: Notification fan-out

**Goal:** When `Notification` rows are created, publish to the user's Redis channel. The sidebar bell + unread count subscribes via the SSE hook. Replaces any current polling.

- [ ] **Step 1: Centralize notification creation** in `src/lib/notifications.ts` (extend the existing helper). Every code path that does `prisma.notification.create(...)` is replaced with `notify({ userId, type, title, body, entityType, entityId })`. Static analysis lint rule prevents direct `notification.create` calls.

- [ ] **Step 2: After insert, publish** to `channels.notifications(userId)` with event type `notification.created` and the full notification row as data.

- [ ] **Step 3: Channel-scoped unread counts**. When a notification is for a communication channel (announcement, forum, DM, complaint), also publish to `channels.channelUnread(userId)` with `{ channelKey, unreadCount }`. The hub's per-channel badges subscribe to this (cross-ref communication-hub plan).

- [ ] **Step 4: Sidebar bell component** subscribes to `notification.created`; appends to a local cache; shows badge count. Click opens `/notifications` (existing route).

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(realtime): phase 2 — notification fan-out via SSE"
  ```

---

## Phase 3: Live voting quorum

**Goal:** When a `Ballot` is cast, publish `{ voteId, votedShares, totalShares, status }`. The voting page subscribes per-vote; the quorum bar updates live. No write-logic changes — fan-out only.

- [ ] **Step 1: Subscribe-on-demand**. Add `POST /api/realtime/subscribe` that accepts `{ topic: "vote", id: voteId }`. Server validates the user has access to the vote, then attaches that vote's Redis channel to the user's existing SSE connection. Drop subscription on `DELETE`.

- [ ] **Step 2: After ballot insert** in the existing voting server action, compute `votedShares` and `totalShares` (these come from `Ballot.weight` summed and `Building.totalUnits`'s aggregate ownership share). Publish to `channels.vote(voteId)` with event `vote.tally`.

- [ ] **Step 3: Voting page hook**. On mount, calls subscribe; renders quorum bar from a useState fed by `useRealtimeStream`. On unmount, unsubscribes.

- [ ] **Step 4: Tie-in with megismételt közgyűlés rule**. The legal-alignment plan flags that supermajorities anchor on **total** shares regardless of attendance. The published payload must include both the present-shares quorum AND the absolute total-share threshold for the active majority type. Quorum bar shows both.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(realtime): phase 3 — live voting quorum tally"
  ```

---

## Phase 4: Bidirectional WebSocket worker

**Goal:** A separate Node process under `realtime/` running `ws`. Handles presence beacons (heartbeat every 30 s) and typing indicators. Uses the same Redis channels for fan-out — SSE clients see WS-originated events too, and vice versa.

- [ ] **Step 1: Realtime service in docker-compose**. New service `realtime` running `node realtime/index.js` (built TS), exposed on port 3030 internally. nginx proxies `/ws` to it. Sticky sessions NOT required — pure stateless because Redis is the truth.

- [ ] **Step 2: WS server** at `realtime/index.ts`. On upgrade: validate the NextAuth JWT from the cookie via `realtime-auth.ts`; reject if no active building membership. Each connection joins `presence:{buildingId}` and any conversation/vote channels the client requests.

- [ ] **Step 3: Presence**. Client sends `{ type: "presence.heartbeat" }` every 30 s. Server tracks `presence:{buildingId}:online` as a Redis sorted set of `userId → lastSeen` with TTL 90 s. On heartbeat, server publishes `presence.update` to the building channel with the current online set (delta only). Hub channel-list reads this for green dots.

- [ ] **Step 4: Typing indicators**. Client sends `{ type: "typing.start", channelKey }` and `{ type: "typing.stop", ... }`. Server publishes `typing.user-active` and `typing.user-idle` to `channels.conversation(id)`. Auto-idle after 5 s of no activity.

- [ ] **Step 5: Reconnect + cleanup**. On disconnect, decrement presence; publish a final `presence.update`. Heartbeats less than every 90 s drop the user from the online set anyway (TTL).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(realtime): phase 4 — WebSocket worker for presence + typing"
  ```

---

## Phase 5: Web push

**Goal:** When a notification is created and the user has a registered `PushSubscription`, send a web push. Replaces or complements SSE for offline / closed-tab delivery.

- [ ] **Step 1: VAPID keys** in env. Generated once via `web-push generate-vapid-keys`. Store as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:contact@<domain>`.

- [ ] **Step 2: Subscription endpoint** at `src/app/api/notifications/push/subscribe/route.ts`. Accepts the browser's `PushSubscriptionJSON`, persists to `PushSubscription` table.

- [ ] **Step 3: Service worker** at `public/sw.js`. Listens for `push` event, displays a notification with title/body. Click opens the `/notifications` page or a specific entity URL based on `data.url`.

- [ ] **Step 4: Send-push job** in `worker/jobs/notification-fanout.ts`. After publishing to Redis, also queue a BullMQ job that loads the user's `PushSubscription` rows and calls `web-push` for each. Auto-prune subscriptions on 410 (gone).

- [ ] **Step 5: Don't double-notify**. SSE-connected users get the in-app event; if they're in the foreground, the push is suppressed by the service worker (`navigator.serviceWorker.controller` check).

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(realtime): phase 5 — web push for notifications"
  ```

---

## Compliance notes

The legal-alignment plan documents that **email** is the only legally-equivalent delivery channel for the meghívó (Tht. § 33/A). SSE, WebSocket, and web push are **not** legal substitutes — they are supplementary. The announcement-delivery flow (in the legal-alignment plan, Phase 5a) records `AnnouncementDelivery` rows per channel, and the email row is the one that satisfies § 33/A. Real-time delivery is best-effort.

---

## Out of scope (tracked for follow-up)

- **SMS** — separate provider plan (Twilio / Vonage / Hungarian SMS gateway).
- **Email delivery proof** — handled in legal-alignment plan, Phase 5a.
- **Mobile-native push** (iOS APNs, Android FCM beyond web push) — when the mobile app appears.
- **Real-time collaborative editing** of documents, minutes, votes — no module needs it.
- **Server-sent video / audio streaming** — out of scope.
- **Per-IP rate limiting on SSE/WS connections** — defer until first abuse.

---

## Acceptance criteria

This plan is complete when:

1. `Notification` create triggers SSE fan-out within **500 ms p95** end-to-end (insert → client `onmessage`).
2. Casting a ballot updates the quorum bar of every connected viewer of that vote within **1 s p95**.
3. Disconnect + reconnect within 30 s does not drop notifications — the `Last-Event-ID` replay covers the gap.
4. Closing the tab and casting a ballot from another device delivers a web push to the closed tab within **5 s**.
5. Two clients in the same conversation see each other's typing indicator within **300 ms**.
6. Presence dot turns red within **90 s** of a user closing the last tab.
7. Redis pub/sub failure causes graceful degrade — connections stay up; notifications fall back to a 30 s polling loop.
8. The `web-push` send loop prunes any `PushSubscription` returning 410 within one job cycle.
9. SSE and WS auth both reject upgrade requests with no active `UserBuilding` for the claimed `buildingId`.
10. All channel names match the typed contract in `realtime-channels.ts` — no string literals elsewhere (lint-enforced).

When all ten hold, real-time is production-ready.
