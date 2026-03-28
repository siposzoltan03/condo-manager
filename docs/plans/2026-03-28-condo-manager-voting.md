# Condo Manager — Voting & Meetings Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Voting & Meetings module — governance votes weighted by ownership share, secret ballot support, quorum tracking, meeting RSVP, minutes upload.

**Architecture:** Extends the Foundation with voting/meeting models. Votes are weighted by unit ownership share. Secret ballots store no userId, returning a receipt hash instead. Quorum = sum of ballot weights / total ownership shares. Auto-close via BullMQ delayed job at vote deadline.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, BullMQ, Tailwind CSS, lucide-react, next-intl

**Spec:** `docs/superpowers/specs/2026-03-25-condo-manager-design.md`
**Design refs:** `docs/reference/stitch-voting-design.md`
**GitHub Issues:** #30–#34 in `siposzoltan03/condo-manager`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── voting/
│   │       ├── votes/
│   │       │   ├── route.ts                        # GET list (filtered, paginated), POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts                    # GET detail, PATCH update
│   │       │       └── ballot/
│   │       │           └── route.ts                # POST cast ballot
│   │       ├── meetings/
│   │       │   ├── route.ts                        # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts                    # GET detail, PATCH update, DELETE
│   │       │       ├── rsvp/
│   │       │       │   └── route.ts                # POST RSVP
│   │       │       └── minutes/
│   │       │           └── route.ts                # POST upload minutes
│   │       └── proxy/
│   │           └── route.ts                        # POST assign/revoke proxy
│   └── [locale]/
│       └── voting/
│           └── page.tsx                            # Voting & Meetings portal
├── components/
│   └── voting/
│       ├── voting-page.tsx                         # Main page with tabs
│       ├── active-vote-card.tsx                    # Full active vote card with voting interface
│       ├── past-vote-card.tsx                      # Past vote result card with bar chart
│       ├── vote-sidebar.tsx                        # Right sidebar (polls, next meeting, info)
│       ├── meeting-list.tsx                        # Meeting list tab content
│       ├── meeting-card.tsx                        # Individual meeting card
│       ├── create-vote-modal.tsx                   # Admin: create new vote
│       ├── create-meeting-modal.tsx                # Admin: create new meeting
│       └── rsvp-button.tsx                         # RSVP button component
├── lib/
│   └── voting/
│       └── quorum.ts                              # Quorum calculation helpers
└── worker/
    (update index.ts for vote-close-check job)
```

---

## Task 1 — Schema: Meeting, Vote, Ballot, ProxyAssignment (Issue #30)

**Commit message:** `feat(voting): add schema — Meeting, Vote, Ballot, ProxyAssignment`

### Steps

- [ ] Add enums to `prisma/schema.prisma`:
  - `VoteType`: YES_NO, MULTIPLE_CHOICE, RANKED_CHOICE
  - `VoteStatus`: DRAFT, OPEN, CLOSED
  - `RsvpStatus`: ATTENDING, NOT_ATTENDING, PROXY
- [ ] Add `Meeting` model: id, title, description, date, time, location, agenda (Json), minutes (text, nullable), createdById, createdAt, updatedAt
- [ ] Add `MeetingRsvp` model: id, meetingId, userId, status (RsvpStatus), createdAt; unique(meetingId, userId)
- [ ] Add `Vote` model: id, title, description, voteType (VoteType), status (VoteStatus), isSecret, quorumRequired (Decimal), deadline, meetingId (nullable), createdById, createdAt, updatedAt
- [ ] Add `VoteOption` model: id, voteId, label, sortOrder
- [ ] Add `Ballot` model: id, voteId, optionId, unitId, userId (nullable for secret), weight (Decimal), receiptHash (nullable), createdAt; unique(voteId, unitId)
- [ ] Add `ProxyAssignment` model: id, grantorId, granteeId, voteId (nullable = general proxy), validFrom, validUntil, createdAt
- [ ] Add relations to User model for meetings, rsvps, votes, ballots, proxies
- [ ] Run `npx prisma generate` and verify build

---

## Task 2 — Meeting Management API: CRUD, RSVP, Minutes (Issue #31)

**Commit message:** `feat(voting): meeting management API — CRUD, RSVP, minutes`

### Steps

- [ ] Create `src/app/api/voting/meetings/route.ts` — GET (list all meetings, paginated) + POST (board+ creates meeting)
- [ ] Create `src/app/api/voting/meetings/[id]/route.ts` — GET detail + PATCH update + DELETE (board+)
- [ ] Create `src/app/api/voting/meetings/[id]/rsvp/route.ts` — POST set RSVP status (upsert unique meetingId+userId)
- [ ] Create `src/app/api/voting/meetings/[id]/minutes/route.ts` — POST upload/set minutes text (board+)
- [ ] Add audit logs for meeting CRUD operations
- [ ] Verify build

---

## Task 3 — Voting Engine: Ballots, Quorum, Proxy, Secret Ballot, Auto-close (Issue #32)

**Commit message:** `feat(voting): voting engine — ballots, quorum, proxy, secret ballot, auto-close`

### Steps

- [ ] Create `src/lib/voting/quorum.ts` — calculateQuorum(voteId): sum ballot weights / total eligible ownership shares
- [ ] Create `src/app/api/voting/votes/route.ts` — GET (list votes, filter by status) + POST (board+ creates vote with options, schedules auto-close job)
- [ ] Create `src/app/api/voting/votes/[id]/route.ts` — GET detail (includes options, ballot counts, quorum; results only if CLOSED) + PATCH (update/close)
- [ ] Create `src/app/api/voting/votes/[id]/ballot/route.ts` — POST cast ballot:
  - Validate vote is OPEN and deadline not passed
  - Check unique constraint (one ballot per unit per vote)
  - Weight = unit's ownershipShare
  - If secret: userId = null, generate receiptHash = SHA256(ballotId + env.BALLOT_SECRET), return hash
  - If proxy: verify ProxyAssignment exists
- [ ] Create `src/app/api/voting/proxy/route.ts` — POST assign proxy (grantor delegates to grantee) + DELETE revoke
- [ ] Add BullMQ `votingQueue` to `src/lib/queue.ts`
- [ ] Add `vote-auto-close` job processor to worker: checks deadline, closes vote, sends notifications
- [ ] Verify build

---

## Task 4 — Governance Portal UI Matching Stitch Design (Issue #33)

**Commit message:** `feat(voting): governance portal UI matching Stitch design`

### Steps

- [ ] Create `src/app/[locale]/voting/page.tsx` — page wrapper
- [ ] Create `src/components/voting/voting-page.tsx` — main layout: tabs + 3-col grid
- [ ] Create `src/components/voting/active-vote-card.tsx` — countdown timer, quorum bar, vote radio buttons, submit
- [ ] Create `src/components/voting/past-vote-card.tsx` — result badge (PASSED/DEFEATED), bar chart distribution
- [ ] Create `src/components/voting/vote-sidebar.tsx` — other polls, next meeting card, voting info
- [ ] Create `src/components/voting/meeting-list.tsx` — meetings tab with meeting cards
- [ ] Create `src/components/voting/meeting-card.tsx` — date badge, title, RSVP status, attendee count
- [ ] Create `src/components/voting/create-vote-modal.tsx` — admin form: title, description, type, options, deadline, secret toggle
- [ ] Create `src/components/voting/create-meeting-modal.tsx` — admin form: title, date, time, location, agenda
- [ ] Create `src/components/voting/rsvp-button.tsx` — RSVP dropdown/buttons
- [ ] Add voting.* i18n keys to `src/i18n/en.json` and `src/i18n/hu.json`
- [ ] Verify build

---

## Task 5 — Navigation Update (Issue #34)

**Commit message:** `feat(voting): update navigation`

### Steps

- [ ] Verify sidebar already has voting nav item (it does — `{ key: "voting", href: "/voting", icon: Vote, minimumRole: "TENANT" }`)
- [ ] Add sub-items if needed (meetings sub-route)
- [ ] Verify build and all navigation works

---

## Acceptance Criteria

- All residents can view active votes and cast ballots weighted by ownership share
- Secret ballots return a receipt hash and store no userId
- Quorum calculation correctly sums ballot weights vs total eligible shares
- Board members can create/manage votes and meetings
- Auto-close job fires at vote deadline
- Proxy voting allows delegation
- One ballot per unit per vote enforced
- Meeting RSVP with attendee count tracking
- UI matches Stitch design reference with tabs, 3-column layout, countdown timers, result charts
- i18n keys in both hu and en locale files
- All builds pass
