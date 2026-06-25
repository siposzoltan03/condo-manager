# Communication Hub Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four separate communication routes (`/announcements`, `/forum`, `/messages`, `/complaints`) with a unified hub at `/communication` that matches the design (`App - Communication.html`). Preserve the four entity types (different models, different rules); merge only the presentation layer. Underlying server actions, schemas, and access rules stay intact.

**Architecture:** Single route, channel-type discriminator. The URL `/communication/[channelKey]` selects which feed renders in the middle column. The channel list (left) is a derived view-model that aggregates announcements + forum categories + DM conversations + complaints. Six phases: shell, feeds, composers, real-time, search, retire-old-routes.

**Tech Stack:** Next.js 15 (app router, React 19), TypeScript, Prisma, NextAuth v5, next-intl, Tailwind v4. Cross-references: `2026-04-28-real-time-infrastructure.md` (Phase 4 of this plan needs the real-time hooks), `2026-04-27-roles-legal-alignment.md` (Phase 3 uses the `can()` capability map).

**Spec source:** Audit findings dated 2026-04-28; cross-references the original `docs/plans/2026-03-25-condo-manager-communication.md`.

**Non-goals:**
- Email + SMS as channel types — legal § 33/A delivery is its own concern, not a hub channel.
- Cross-building messaging — every channel is building-scoped.
- AI auto-categorization or summarization (separate plan).
- Mobile-native chat experience — mobile-responsive desktop is enough for this pass.
- Dropping the Complaints workflow — the SUBMITTED → UNDER_REVIEW → IN_PROGRESS → RESOLVED/REJECTED flow stays; it just renders inside the hub.
- Changing entity-level RBAC — visibility rules per channel are unchanged.

---

## File Structure — What Changes

```
src/
├── app/
│   ├── [locale]/
│   │   └── communication/
│   │       ├── page.tsx                    # NEW: hub root, redirects to default channel
│   │       └── [channelKey]/
│   │           └── page.tsx                # NEW: per-channel feed
│   └── (old routes — redirected in Phase 6)
│       ├── announcements/                  # 301 → /communication/announcements
│       ├── forum/                          # 301 → /communication/forum-{categoryId}
│       ├── messages/                       # 301 → /communication/dm-{conversationId}
│       └── complaints/                     # 301 → /communication/complaints
├── components/
│   └── communication/
│       ├── HubLayout.tsx                   # NEW: 3-column shell (channels / feed / detail)
│       ├── ChannelList.tsx                 # NEW: left column with badges + presence
│       ├── ChannelComposer.tsx             # NEW: dispatches to per-type composer
│       ├── feeds/
│       │   ├── AnnouncementFeed.tsx
│       │   ├── ForumFeed.tsx
│       │   ├── DMFeed.tsx
│       │   └── ComplaintFeed.tsx
│       ├── composers/
│       │   ├── AnnouncementComposer.tsx
│       │   ├── ForumComposer.tsx
│       │   ├── DMComposer.tsx
│       │   └── ComplaintComposer.tsx
│       └── ThreadDetail.tsx                # NEW: right column when an item is selected
├── lib/
│   └── channels.ts                         # NEW: listChannelsForUser + types
├── middleware.ts                           # MODIFY (Phase 6): redirect old routes
└── i18n/messages/
    ├── hu.json                             # MODIFY: communication.* keys
    └── en.json                             # MODIFY
prisma/
└── schema.prisma                           # MODIFY (Phase 1): add ForumTopicRead
```

No Prisma changes for the four core entities — `Announcement`, `Forum*`, `Conversation`, `Complaint` stay as-is. Only `ForumTopicRead` is added (Phase 1) for forum unread tracking, since `ForumTopic` has no per-user read state today.

---

## The `Channel` view-model (the heart of this refactor)

```ts
type ChannelKey =
  | "announcements"
  | `forum-${string}`         // forum-{categoryId}
  | `dm-${string}`            // dm-{conversationId}
  | "complaints";

type Channel = {
  key: ChannelKey;
  type: "announcements" | "forum" | "dm" | "complaints";
  label: string;
  icon: string;               // emoji or icon name
  unreadCount: number;
  lastActivityAt: Date | null;
  presence?: { onlineUserIds: string[] };  // populated by real-time, Phase 4
  permissions: {
    canRead: boolean;
    canPost: boolean;
    canModerate: boolean;
  };
};

export async function listChannelsForUser(userId: string, buildingId: string): Promise<Channel[]>;
```

`listChannelsForUser` is the only thing the channel list renders from. It fans out queries:
- Announcements: 1 channel per building.
- Forum: 1 channel per `ForumCategory` row in the building.
- DMs: 1 channel per `Conversation` the user participates in.
- Complaints: 1 channel per building (or scoped to "my complaints" for non-board users).

Sorted by `lastActivityAt DESC`.

---

## Phase 1: Hub shell + channel list (read-only)

**Goal:** Standalone `/communication` route with the 3-column layout. Channel list works (loads data, sorts, shows static counts). No feed yet, no composer. Existing four routes still work and are unaffected.

- [ ] **Step 1: Add `ForumTopicRead`** to track per-user last-seen on forum topics:
  ```prisma
  model ForumTopicRead {
    id        String      @id @default(cuid())
    user      User        @relation(fields: [userId], references: [id])
    userId    String
    topic     ForumTopic  @relation(fields: [topicId], references: [id])
    topicId   String
    lastSeenAt DateTime   @default(now())
    @@unique([userId, topicId])
  }
  ```
  Migration: `phase1-forum-topic-read`.

- [ ] **Step 2: `src/lib/channels.ts`**. Implement `listChannelsForUser` with the four fan-out queries. Compute `unreadCount`:
  - Announcements: count of `Announcement` rows in this building without an `AnnouncementRead` row for `userId`.
  - Forum (per category): count of `ForumTopic` rows with `latestReplyAt > ForumTopicRead.lastSeenAt` (or no `ForumTopicRead` row).
  - DM (per conversation): count of `Message` rows with `createdAt > ConversationParticipant.lastReadAt` for this user.
  - Complaints: count of `Complaint` rows with status not in `(RESOLVED, REJECTED)` that the user can see.

- [ ] **Step 3: `<HubLayout>`** — three-column CSS grid: `260px channels | 1fr feed | 360px detail`. Detail collapses on narrow viewport.

- [ ] **Step 4: `<ChannelList>`** — left column. Renders `Channel[]` with: icon · label · unread badge (mono pill, ochre when >0) · `lastActivityAt` relative time. Selected channel uses `var(--ink)` background.

- [ ] **Step 5: Route stub** — `/communication/page.tsx` redirects to the channel with the highest unread count, or to `announcements` if all zero. `/communication/[channelKey]/page.tsx` renders `<HubLayout>` with the channel selected; middle and right columns are empty in this phase.

- [ ] **Step 6: i18n keys** — `communication.channels.announcements`, `communication.channels.forum`, etc.

- [ ] **Step 7: Migration + commit**
  ```bash
  npx prisma migrate dev --name phase1-forum-topic-read
  git commit -m "feat(comm-hub): phase 1 — hub shell + channel list (read-only)"
  ```

---

## Phase 2: Feed renderers, read-only

**Goal:** Selected channel renders the appropriate feed component in the middle column. Read-only — no composers yet.

- [ ] **Step 1: `<AnnouncementFeed>`** — paginated list of `Announcement` rows for the building, newest first. Each row shows title, body excerpt, target audience pill, read-receipt count. Click → `<ThreadDetail>` shows full body + read-receipt grid (the dense per-user grid from the design, Phase 5 if too heavy now).

- [ ] **Step 2: `<ForumFeed>`** — list of `ForumTopic` rows for the selected category, sorted by `lastReplyAt DESC`. Pinned topics first. Each row: title · author · reply count · last activity. Click → `<ThreadDetail>` shows topic + nested replies (use `ForumReply.parentReplyId` for tree).

- [ ] **Step 3: `<DMFeed>`** — full thread of the selected conversation. Renders `Message` rows newest at the bottom. Day separators (`<DaySeparator>`).

- [ ] **Step 4: `<ComplaintFeed>`** — board / admin sees all complaints in the building; non-board users see only their own. Each row: title · category · status pill · age. Click → `<ThreadDetail>` with full body + internal notes (board-only).

- [ ] **Step 5: Mark-as-read on view**. When a feed item is opened in `<ThreadDetail>`:
  - Announcement → upsert `AnnouncementRead`
  - Forum topic → upsert `ForumTopicRead { lastSeenAt: now }`
  - DM conversation → update `ConversationParticipant.lastReadAt = now` for current user
  - Complaint → no read state (status workflow handles it)
  Each upsert reduces the unread count and (Phase 4) publishes to real-time.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(comm-hub): phase 2 — feed renderers + mark-as-read"
  ```

---

## Phase 3: Composers

**Goal:** Per-channel composer with action wiring. **Existing `createAnnouncement`, `createTopic`, `sendMessage`, `createComplaint` server actions are reused — no DAL changes.**

- [ ] **Step 1: `<ChannelComposer>`** dispatches based on `channel.type`. If `permissions.canPost = false`, renders nothing.

- [ ] **Step 2: `<AnnouncementComposer>`**:
  - Fields: title, body (markdown), targetAudience (`ALL` / `BOARD_ONLY` / `SPECIFIC_UNITS`), publishToBoard checkbox (drives the § 33/A delivery proof — cross-ref legal-alignment plan, Phase 5a).
  - Capability gate: `announcement.publish` (board chair + ADMIN).
  - For SPECIFIC_UNITS: a multi-select of units in this building.

- [ ] **Step 3: `<ForumComposer>`**:
  - Fields: title, body, optional category override (defaults to selected forum category).
  - Capability: any building member with `canPost`.

- [ ] **Step 4: `<DMComposer>`** — single textarea + send button. Image attachments via the file-storage upload helper (cross-ref file-storage plan).

- [ ] **Step 5: `<ComplaintComposer>`**:
  - Fields: category enum, body, optional photos.
  - Visibility: any building member can submit; board moderates.

- [ ] **Step 6: Optimistic updates**. On submit, append the new item to the feed locally with a "sending..." status; replace with the real row when the server action returns.

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "feat(comm-hub): phase 3 — per-channel composers wired to existing server actions"
  ```

---

## Phase 4: Real-time presence + unread + typing

**Goal:** Channel list shows presence dots and live unread counts. DM threads show typing indicators. **Depends on real-time infrastructure plan being landed.**

- [ ] **Step 1: `useChannelUnread()` hook** subscribes to the `unread:{userId}` SSE channel from the real-time plan. Returns `Map<ChannelKey, number>`. `<ChannelList>` re-renders on every event.

- [ ] **Step 2: `useChannelPresence(buildingId)` hook** subscribes via WebSocket to `presence:{buildingId}`. Returns `Set<userId>` of users currently online. Channel rows for DMs show a green dot if the other participant is online.

- [ ] **Step 3: `useTypingIndicator(channelKey)` hook** — for DM channels only. WebSocket events `typing.user-active` / `typing.user-idle` from the real-time plan. `<DMFeed>` shows "X is typing…" footer when active.

- [ ] **Step 4: Heartbeat**. While the hub is open, the client sends a `presence.heartbeat` every 30 s. On unmount or tab close, send a `presence.leave`.

- [ ] **Step 5: When new content arrives via real-time** (announcement created, message received): update the channel-list `lastActivityAt` and `unreadCount` locally; if the channel is currently selected and visible, also append to the feed.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(comm-hub): phase 4 — presence, unread, typing via real-time"
  ```

---

## Phase 5: Cross-channel search and filters

**Goal:** Header search bar filters across all channel types. Per-channel filters (date range, author, status for complaints).

- [ ] **Step 1: Search route** at `src/app/api/communication/search/route.ts`. Accepts `q` and optional `channelKey`. Returns mixed result list with `{ type, channelKey, id, title/snippet, matchedField, createdAt }`. Initially: `ILIKE` queries against the four entities. Pagination: 20 per request.

- [ ] **Step 2: Search UI** — header text input. As-you-type debounced. Results dropdown shows top 10 hits across channels with icons by type. Click navigates to the channel + item.

- [ ] **Step 3: Per-channel filters** — date range picker, author filter (autocomplete from building members), status filter for complaints.

- [ ] **Step 4: Defer full-text search**. If/when a Meilisearch / Postgres FTS plan lands, swap the `ILIKE` for proper indexes. Note this in the plan.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(comm-hub): phase 5 — cross-channel search + per-channel filters"
  ```

---

## Phase 6: Retire old routes

**Goal:** Redirect the four old routes to the new hub. Drop the old per-feature page components after a deprecation window.

- [ ] **Step 1: Middleware redirects** in `src/middleware.ts`:
  - `/[locale]/announcements` → `/[locale]/communication/announcements` (301)
  - `/[locale]/announcements/[id]` → `/[locale]/communication/announcements?item=[id]`
  - `/[locale]/forum` → `/[locale]/communication/forum-default` (or first category)
  - `/[locale]/forum/[categoryId]` → `/[locale]/communication/forum-[categoryId]`
  - `/[locale]/forum/topic/[id]` → `/[locale]/communication/forum-X?item=[id]` (look up category)
  - `/[locale]/messages` → `/[locale]/communication` (hub picks default channel)
  - `/[locale]/messages/[conversationId]` → `/[locale]/communication/dm-[conversationId]`
  - `/[locale]/complaints` → `/[locale]/communication/complaints`
  - `/[locale]/complaints/[id]` → `/[locale]/communication/complaints?item=[id]`

- [ ] **Step 2: Sidebar update**. Remove the four separate sidebar items; add a single "Kommunikáció" entry pointing at `/communication`. The badge count is the sum of channel unread counts.

- [ ] **Step 3: Deprecation window**. Keep the old page components (now unreachable except via direct URL) for two weeks after deploy. Server actions stay forever — they back the new hub.

- [ ] **Step 4: After two weeks** — delete the old page files (`src/app/[locale]/{announcements,forum,messages,complaints}/page.tsx` and friends). Server actions stay. Search the codebase for any remaining hardcoded links to the old routes.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(comm-hub): phase 6 — retire old routes (with two-week 301 deprecation)"
  ```

---

## Cross-references

- **Capability gates** (legal-alignment plan): every composer checks `can(actor, capability)` — `announcement.publish`, `announcement.boardChannel`, etc.
- **Real-time** (real-time plan): Phase 4 here depends on Phases 1-2 there. If the real-time plan slips, Phase 4 here ships with polling (every 30 s) as a degraded fallback.
- **File storage** (file-storage plan): DM and complaint composers' photo uploads use the same signed-URL helper.
- **Audit log** (audit-ui plan): every post / edit / delete in any channel writes an `AuditLog` row via the standard helper.

---

## Out of scope (tracked for follow-up)

- **Email + SMS as channel types** — legal § 33/A delivery is in the legal-alignment plan, not here.
- **Cross-building messaging** — every channel is building-scoped.
- **AI features** — auto-categorization, summarization, sentiment — separate plan.
- **Reactions / emojis on messages** — out of scope for this pass.
- **Voice / video** — out of scope.
- **Full-text search** with proper indexing — Phase 5 here uses ILIKE; FTS is a separate plan.

---

## Acceptance criteria

This plan is complete when:

1. `/announcements` redirects (301) to `/communication/announcements` with the same data visible.
2. A user lacking `announcement.publish` capability sees the announcements channel but no composer.
3. Selecting a forum category in the channel list deep-links to `/communication/forum-{categoryId}` (URL changes; back button works).
4. Unread count on the sidebar's single "Kommunikáció" entry equals the sum of unread counts across all four channel types for the user.
5. Posting a message in a DM updates the other participant's unread count via real-time within **1 s p95**.
6. Marking a complaint as `IN_PROGRESS` from the hub uses the existing complaint status server action (no new code path).
7. The four old routes return **301** to the new hub after Phase 6.
8. Forum topic mark-as-read logic uses `ForumTopicRead` and unread counts go to zero on visit.
9. The hub renders correctly at 1024px viewport (3-column collapses to 1-column with channel list as a slide-out drawer).
10. No new server actions added — all four entity types still use their existing CRUD actions.

When all ten hold, the four communication routes have been merged into a single hub without altering any underlying business logic.
