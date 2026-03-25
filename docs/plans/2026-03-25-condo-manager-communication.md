# Condo Manager — Communication Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Communication module — announcements, forum, direct messaging, and formal complaints.

**Architecture:** Extends the Foundation with 4 sub-modules. Each has Prisma models, API routes (Server Actions or Route Handlers), and React client components. All mutations trigger the notification engine. All state changes are audit-logged.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, BullMQ, Tailwind CSS, lucide-react, next-intl

**Spec:** `docs/superpowers/specs/2026-03-25-condo-manager-design.md`
**Design refs:** `docs/superpowers/reference/stitch-announcements-design.md`, `docs/superpowers/reference/stitch-forum-design.md`

**GitHub Issues:** #13–#20 in `siposzoltan03/condo-manager`

---

## File Structure

```
src/
├── app/
│   └── [locale]/
│       ├── announcements/
│       │   ├── page.tsx                    # announcement list
│       │   └── [id]/
│       │       └── page.tsx                # announcement detail
│       ├── forum/
│       │   ├── page.tsx                    # forum categories + topic list
│       │   └── [topicId]/
│       │       └── page.tsx                # topic detail + replies
│       ├── messages/
│       │   └── page.tsx                    # conversations + message thread
│       └── complaints/
│           ├── page.tsx                    # complaint list
│           └── [id]/
│               └── page.tsx                # complaint detail
├── app/api/
│   ├── announcements/
│   │   ├── route.ts                        # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts                    # GET detail, PATCH update, DELETE
│   │       └── read/
│   │           └── route.ts                # POST mark as read
│   ├── forum/
│   │   ├── categories/
│   │   │   └── route.ts                    # GET categories with counts
│   │   ├── topics/
│   │   │   ├── route.ts                    # GET list, POST create
│   │   │   └── [topicId]/
│   │   │       ├── route.ts                # GET detail, PATCH pin/lock, DELETE
│   │   │       └── replies/
│   │   │           └── route.ts            # GET replies, POST reply
│   ├── messages/
│   │   ├── conversations/
│   │   │   ├── route.ts                    # GET list, POST create
│   │   │   └── [conversationId]/
│   │   │       ├── route.ts                # GET messages
│   │   │       ├── messages/
│   │   │       │   └── route.ts            # POST send message
│   │   │       └── read/
│   │   │           └── route.ts            # POST mark read
│   └── complaints/
│       ├── route.ts                        # GET list, POST create
│       └── [id]/
│           ├── route.ts                    # GET detail, PATCH status
│           └── notes/
│               └── route.ts                # POST add note
├── components/
│   ├── announcements/
│   │   ├── announcement-list.tsx
│   │   ├── announcement-card.tsx
│   │   ├── announcement-detail.tsx
│   │   ├── announcement-form.tsx
│   │   └── announcement-filters.tsx
│   ├── forum/
│   │   ├── category-sidebar.tsx
│   │   ├── topic-list.tsx
│   │   ├── topic-row.tsx
│   │   ├── pinned-topic-card.tsx
│   │   ├── topic-detail.tsx
│   │   ├── reply-thread.tsx
│   │   ├── reply-form.tsx
│   │   └── new-topic-form.tsx
│   ├── messages/
│   │   ├── conversation-list.tsx
│   │   ├── conversation-item.tsx
│   │   ├── message-thread.tsx
│   │   ├── message-bubble.tsx
│   │   ├── message-input.tsx
│   │   └── new-conversation-modal.tsx
│   └── complaints/
│       ├── complaint-list.tsx
│       ├── complaint-card.tsx
│       ├── complaint-detail.tsx
│       ├── complaint-form.tsx
│       ├── complaint-notes.tsx
│       └── status-timeline.tsx
└── i18n/
    ├── en.json                             # add announcements, forum, messages, complaints keys
    └── hu.json                             # same
prisma/
└── schema.prisma                           # add Communication models
```

---

## Task 1: Communication Database Schema (Issues #13, #15, #17, #19)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add all Communication models to Prisma schema**

Add these models (keep all existing models intact):

```prisma
// === Communication: Announcements ===

enum TargetAudience {
  ALL
  SPECIFIC_UNITS
  BOARD_ONLY
}

model Announcement {
  id              String          @id @default(cuid())
  title           String
  body            String          @db.Text
  author          User            @relation("AnnouncementAuthor", fields: [authorId], references: [id])
  authorId        String
  targetAudience  TargetAudience  @default(ALL)
  attachments     Json            @default("[]")  // array of { url, name, size }
  reads           AnnouncementRead[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([createdAt])
  @@index([authorId])
}

model AnnouncementRead {
  id              String       @id @default(cuid())
  user            User         @relation(fields: [userId], references: [id])
  userId          String
  announcement    Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  announcementId  String
  readAt          DateTime     @default(now())

  @@unique([userId, announcementId])
}

// === Communication: Forum ===

model ForumCategory {
  id          String       @id @default(cuid())
  name        String       @unique
  description String?
  sortOrder   Int          @default(0)
  topics      ForumTopic[]
  createdAt   DateTime     @default(now())
}

model ForumTopic {
  id          String        @id @default(cuid())
  title       String
  body        String        @db.Text
  category    ForumCategory @relation(fields: [categoryId], references: [id])
  categoryId  String
  author      User          @relation("ForumTopicAuthor", fields: [authorId], references: [id])
  authorId    String
  isPinned    Boolean       @default(false)
  isLocked    Boolean       @default(false)
  replies     ForumReply[]
  lastActivityAt DateTime   @default(now())
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([categoryId, lastActivityAt])
  @@index([authorId])
}

model ForumReply {
  id            String      @id @default(cuid())
  body          String      @db.Text
  topic         ForumTopic  @relation(fields: [topicId], references: [id], onDelete: Cascade)
  topicId       String
  author        User        @relation("ForumReplyAuthor", fields: [authorId], references: [id])
  authorId      String
  parentReply   ForumReply? @relation("ReplyThread", fields: [parentReplyId], references: [id])
  parentReplyId String?
  childReplies  ForumReply[] @relation("ReplyThread")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([topicId, createdAt])
}

// === Communication: Direct Messaging ===

enum ConversationType {
  DIRECT
  GROUP
}

model Conversation {
  id           String             @id @default(cuid())
  type         ConversationType   @default(DIRECT)
  name         String?            // for group conversations
  participants ConversationParticipant[]
  messages     Message[]
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
}

model ConversationParticipant {
  id             String       @id @default(cuid())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  conversationId String
  user           User         @relation(fields: [userId], references: [id])
  userId         String
  lastReadAt     DateTime     @default(now())
  joinedAt       DateTime     @default(now())

  @@unique([conversationId, userId])
}

model Message {
  id             String       @id @default(cuid())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  conversationId String
  sender         User         @relation("MessageSender", fields: [senderId], references: [id])
  senderId       String
  body           String       @db.Text
  createdAt      DateTime     @default(now())

  @@index([conversationId, createdAt])
}

// === Communication: Formal Complaints ===

enum ComplaintCategory {
  NOISE
  DAMAGE
  SAFETY
  PARKING
  OTHER
}

enum ComplaintStatus {
  SUBMITTED
  UNDER_REVIEW
  IN_PROGRESS
  RESOLVED
  REJECTED
}

model Complaint {
  id              String           @id @default(cuid())
  author          User             @relation("ComplaintAuthor", fields: [authorId], references: [id])
  authorId        String
  category        ComplaintCategory
  description     String           @db.Text
  photos          Json             @default("[]")  // array of URLs
  isPrivate       Boolean          @default(false)
  trackingNumber  String           @unique
  status          ComplaintStatus  @default(SUBMITTED)
  notes           ComplaintNote[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([status])
  @@index([authorId])
  @@index([createdAt])
}

model ComplaintNote {
  id          String    @id @default(cuid())
  complaint   Complaint @relation(fields: [complaintId], references: [id], onDelete: Cascade)
  complaintId String
  author      User      @relation("ComplaintNoteAuthor", fields: [authorId], references: [id])
  authorId    String
  body        String    @db.Text
  isInternal  Boolean   @default(false)
  createdAt   DateTime  @default(now())

  @@index([complaintId, createdAt])
}
```

**IMPORTANT:** Add all needed relation fields to the existing `User` model:
```prisma
// Add to User model:
announcements        Announcement[]       @relation("AnnouncementAuthor")
announcementReads    AnnouncementRead[]
forumTopics          ForumTopic[]         @relation("ForumTopicAuthor")
forumReplies         ForumReply[]         @relation("ForumReplyAuthor")
conversationParticipants ConversationParticipant[]
sentMessages         Message[]            @relation("MessageSender")
complaints           Complaint[]          @relation("ComplaintAuthor")
complaintNotes       ComplaintNote[]      @relation("ComplaintNoteAuthor")
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-communication-models
```

- [ ] **Step 3: Add seed data for forum categories**

Add to `prisma/seed.ts` (after user creation):
```typescript
// Forum categories
await prisma.forumCategory.createMany({
  data: [
    { name: "General", description: "General discussion", sortOrder: 1 },
    { name: "Noise Complaints", description: "Report noise issues", sortOrder: 2 },
    { name: "Suggestions", description: "Improvement ideas", sortOrder: 3 },
    { name: "Maintenance Tips", description: "DIY and maintenance advice", sortOrder: 4 },
  ],
});
```

Also add `await prisma.forumCategory.deleteMany();` to the cleanup section (before unit/user deletion).
Add cleanup for all new models too: `complaint notes, complaints, messages, conversation participants, conversations, forum replies, forum topics, forum categories, announcement reads, announcements`.

- [ ] **Step 4: Run seed**

```bash
npx prisma db seed
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: communication database schema — announcements, forum, messaging, complaints"
```

---

## Task 2: Announcements API (Issue #13)

**Files:**
- Create: `src/app/api/announcements/route.ts`
- Create: `src/app/api/announcements/[id]/route.ts`
- Create: `src/app/api/announcements/[id]/read/route.ts`

- [ ] **Step 1: Create GET /api/announcements**

- Authenticated users only
- Query params: search (title/body), audience filter, page, limit
- Filter by targetAudience based on user role: Tenants/Residents see ALL + SPECIFIC_UNITS; Board+ see all including BOARD_ONLY
- Return announcements with author (name), read status for current user, attachment count
- Sort by createdAt desc, paginated

- [ ] **Step 2: Create POST /api/announcements**

- Board member+ only (requireRole BOARD_MEMBER)
- Body: title, body (rich text HTML), targetAudience, attachments (JSON array)
- Validate required fields
- Create announcement, audit log
- Trigger notification to relevant users (all users for ALL, board for BOARD_ONLY)

- [ ] **Step 3: Create GET /api/announcements/[id]**

- Get single announcement with full body, author, attachments, read count
- Respect audience visibility

- [ ] **Step 4: Create PATCH /api/announcements/[id]**

- Author or admin only
- Update title, body, targetAudience
- Audit log with old/new values

- [ ] **Step 5: Create DELETE /api/announcements/[id]**

- Author or admin only
- Soft delete or hard delete (hard delete with cascade on reads)
- Audit log

- [ ] **Step 6: Create POST /api/announcements/[id]/read**

- Mark announcement as read for current user
- Upsert (idempotent)

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: announcements CRUD API with audience filtering and read tracking"
```

---

## Task 3: Announcements UI (Issue #14)

**Files:**
- Create: `src/app/[locale]/announcements/page.tsx`
- Create: `src/app/[locale]/announcements/[id]/page.tsx`
- Create: `src/components/announcements/announcement-list.tsx`
- Create: `src/components/announcements/announcement-card.tsx`
- Create: `src/components/announcements/announcement-detail.tsx`
- Create: `src/components/announcements/announcement-form.tsx`
- Create: `src/components/announcements/announcement-filters.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

**Design reference:** `docs/superpowers/reference/stitch-announcements-design.md`

- [ ] **Step 1: Create announcement list page**

- Page header: "Announcements" (4xl, extrabold, text-primary) + subtitle
- "New Announcement" button (board+ only, via RoleGuard)
- Filter bar: keyword search, audience dropdown (All/Board Only), date range
- Announcement cards in reverse chronological order

- [ ] **Step 2: Create announcement card component**

Match Stitch design:
- Unread: white card, blue left border (border-l-4 border-primary), bold title
- Read: same card, opacity-90, no blue border, semibold title
- Author avatar (initials fallback) + name + role + time
- Audience tag (colored badge)
- Unread blue dot indicator
- Body preview (line-clamp-2)
- Footer: attachment count, "Read Full Details →"

- [ ] **Step 3: Create announcement detail page**

- Full announcement body (rendered HTML)
- Author info, date, audience
- Attachment download links
- Auto-mark as read on view (call POST /api/announcements/[id]/read)

- [ ] **Step 4: Create announcement form (modal)**

- Title input
- Rich text body (use a textarea for now, can upgrade to rich editor later)
- Target audience selector (radio: All / Board Only)
- File upload for attachments
- Create/Update mode

- [ ] **Step 5: Add i18n keys**

Add `announcements.*` keys to both en.json and hu.json.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: announcements list and detail UI matching Stitch design"
```

---

## Task 4: Forum API (Issue #15)

**Files:**
- Create: `src/app/api/forum/categories/route.ts`
- Create: `src/app/api/forum/topics/route.ts`
- Create: `src/app/api/forum/topics/[topicId]/route.ts`
- Create: `src/app/api/forum/topics/[topicId]/replies/route.ts`

- [ ] **Step 1: GET /api/forum/categories**

- Return all categories with topic count per category
- Sorted by sortOrder

- [ ] **Step 2: GET /api/forum/topics**

- Query params: categoryId (required), search, page, limit
- Return topics sorted by: pinned first, then lastActivityAt desc
- Include author name, reply count, last activity date

- [ ] **Step 3: POST /api/forum/topics**

- Any authenticated user
- Body: title, body, categoryId
- Auto-sets lastActivityAt to now

- [ ] **Step 4: GET /api/forum/topics/[topicId]**

- Return topic with full body, author, category, pin/lock status

- [ ] **Step 5: PATCH /api/forum/topics/[topicId]**

- Admin only: toggle isPinned, isLocked
- Author or admin: edit title, body

- [ ] **Step 6: DELETE /api/forum/topics/[topicId]**

- Admin only or author
- Cascade deletes replies

- [ ] **Step 7: GET /api/forum/topics/[topicId]/replies**

- Paginated, sorted by createdAt asc
- Include author name, parentReplyId for threading

- [ ] **Step 8: POST /api/forum/topics/[topicId]/replies**

- Any authenticated user (unless topic is locked → 403)
- Body: body, parentReplyId (optional)
- Update topic.lastActivityAt

- [ ] **Step 9: Commit**

```bash
git commit -m "feat: forum API — categories, topics, threaded replies"
```

---

## Task 5: Forum UI (Issue #16)

**Files:**
- Create: `src/app/[locale]/forum/page.tsx`
- Create: `src/app/[locale]/forum/[topicId]/page.tsx`
- Create: `src/components/forum/category-sidebar.tsx`
- Create: `src/components/forum/topic-list.tsx`
- Create: `src/components/forum/topic-row.tsx`
- Create: `src/components/forum/pinned-topic-card.tsx`
- Create: `src/components/forum/topic-detail.tsx`
- Create: `src/components/forum/reply-thread.tsx`
- Create: `src/components/forum/reply-form.tsx`
- Create: `src/components/forum/new-topic-form.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

**Design reference:** `docs/superpowers/reference/stitch-forum-design.md`

- [ ] **Step 1: Create forum page with category sidebar**

- Left sub-panel: category list with icons and topic counts, active category highlighted
- "New Discussion" button at bottom of categories
- Main area: topic list for selected category

- [ ] **Step 2: Create pinned topic cards**

- Grid 2 columns for pinned topics
- Dark card (primary gradient bg) and light card variants
- Pin icon, tag, title, preview, author, date

- [ ] **Step 3: Create topic list rows**

- Avatar + title (bold, primary) + lock icon if locked
- Author name + unit + category
- Reply count + last activity date
- Pagination at bottom

- [ ] **Step 4: Create topic detail page**

- Full topic body, author info, pin/lock badges
- Admin controls: pin/lock/delete buttons
- Reply thread below
- Reply form at bottom (disabled if topic is locked)

- [ ] **Step 5: Create reply thread component**

- Chronological replies with author avatar, name, date
- Simple threading: indented replies for parentReplyId
- "Reply" button per reply (sets parentReplyId in form)

- [ ] **Step 6: Create new topic form (modal)**

- Title, body (textarea), category dropdown

- [ ] **Step 7: Add i18n keys and commit**

```bash
git commit -m "feat: forum UI — categories, topics, threaded replies matching Stitch design"
```

---

## Task 6: Direct Messaging API (Issue #17)

**Files:**
- Create: `src/app/api/messages/conversations/route.ts`
- Create: `src/app/api/messages/conversations/[conversationId]/route.ts`
- Create: `src/app/api/messages/conversations/[conversationId]/messages/route.ts`
- Create: `src/app/api/messages/conversations/[conversationId]/read/route.ts`

- [ ] **Step 1: GET /api/messages/conversations**

- List conversations for current user
- Include: last message preview, other participant(s) name(s), unread count (messages after lastReadAt)
- Sort by last message date desc

- [ ] **Step 2: POST /api/messages/conversations**

- Create direct conversation (find existing with same participants or create new)
- Body: participantIds (array), name (optional, for group)
- For DIRECT: exactly 2 participants (current user + one other)

- [ ] **Step 3: GET /api/messages/conversations/[conversationId]/route.ts**

- Return conversation detail with participants

- [ ] **Step 4: GET /api/messages/conversations/[conversationId]/messages**

- Paginated messages, sorted by createdAt asc (oldest first for chat)
- Only if current user is participant

- [ ] **Step 5: POST /api/messages/conversations/[conversationId]/messages**

- Send message (only if participant)
- Body: body
- Update conversation.updatedAt
- Trigger notification to other participants

- [ ] **Step 6: POST /api/messages/conversations/[conversationId]/read**

- Update current user's lastReadAt to now

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: direct messaging API — conversations, messages, read tracking"
```

---

## Task 7: Direct Messaging UI (Issue #18)

**Files:**
- Create: `src/app/[locale]/messages/page.tsx`
- Create: `src/components/messages/conversation-list.tsx`
- Create: `src/components/messages/conversation-item.tsx`
- Create: `src/components/messages/message-thread.tsx`
- Create: `src/components/messages/message-bubble.tsx`
- Create: `src/components/messages/message-input.tsx`
- Create: `src/components/messages/new-conversation-modal.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

- [ ] **Step 1: Create messages page with split layout**

- Left panel (w-80): conversation list
- Right panel: message thread for selected conversation
- "New Message" button at top of conversation list

- [ ] **Step 2: Create conversation list**

- Each item: participant name(s)/avatar(s), last message preview (truncated), timestamp, unread badge
- Active conversation highlighted
- Sort by most recent message

- [ ] **Step 3: Create message thread**

- Header: participant name(s), group name if group
- Messages: bubble layout (own messages right-aligned blue, others left-aligned gray)
- Each bubble: body, timestamp, sender name (for groups)
- Auto-scroll to newest, mark as read on view

- [ ] **Step 4: Create message input**

- Text input at bottom with send button
- Enter to send, Shift+Enter for newline

- [ ] **Step 5: Create new conversation modal**

- User selector (search by name)
- Optional group name
- Start conversation button

- [ ] **Step 6: Add i18n keys and commit**

```bash
git commit -m "feat: direct messaging UI — conversations and chat interface"
```

---

## Task 8: Complaints API (Issue #19)

**Files:**
- Create: `src/app/api/complaints/route.ts`
- Create: `src/app/api/complaints/[id]/route.ts`
- Create: `src/app/api/complaints/[id]/notes/route.ts`

- [ ] **Step 1: GET /api/complaints**

- All authenticated users
- Filter: search, status, category, page
- Visibility: public complaints visible to all; private ones only to author + admin/board
- Include author name, note count

- [ ] **Step 2: POST /api/complaints**

- Any authenticated user
- Body: category, description, photos (JSON array), isPrivate
- Auto-generate trackingNumber: `CMP-YYYY-NNN` (sequential per year)
- Audit log

- [ ] **Step 3: GET /api/complaints/[id]**

- Full detail with notes (hide internal notes from non-admin)
- Respect private visibility

- [ ] **Step 4: PATCH /api/complaints/[id]**

- Admin/board only: update status
- Trigger notification on status change
- Audit log

- [ ] **Step 5: GET /api/complaints/[id]/notes**

- List notes for complaint
- Hide isInternal notes from non-admin users

- [ ] **Step 6: POST /api/complaints/[id]/notes**

- Admin: can set isInternal=true (internal notes never visible to residents)
- Non-admin: isInternal always false
- Trigger notification to relevant parties

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: complaints API — submit, track, notes with visibility control"
```

---

## Task 9: Complaints UI (Issue #20)

**Files:**
- Create: `src/app/[locale]/complaints/page.tsx`
- Create: `src/app/[locale]/complaints/[id]/page.tsx`
- Create: `src/components/complaints/complaint-list.tsx`
- Create: `src/components/complaints/complaint-card.tsx`
- Create: `src/components/complaints/complaint-detail.tsx`
- Create: `src/components/complaints/complaint-form.tsx`
- Create: `src/components/complaints/complaint-notes.tsx`
- Create: `src/components/complaints/status-timeline.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

- [ ] **Step 1: Create complaint list page**

- Filter bar: search, status filter (All/Submitted/Under Review/In Progress/Resolved/Rejected), category filter
- "Submit Complaint" button
- Complaint cards with: tracking number, category icon, description preview, status badge (color-coded), date, private indicator

- [ ] **Step 2: Create status badges**

Color-coded:
- Submitted: gray (bg-slate-100)
- Under Review: blue (bg-blue-100)
- In Progress: yellow (bg-amber-100)
- Resolved: green (bg-emerald-100)
- Rejected: red (bg-red-100)

- [ ] **Step 3: Create complaint detail page**

- Full description, photos gallery, tracking number
- Status timeline showing progression
- Notes thread (internal notes styled differently for admin — yellow bg)
- Admin controls: status change dropdown, add note with internal toggle
- Reporter can see public notes only

- [ ] **Step 4: Create complaint form (modal/page)**

- Category dropdown
- Description textarea
- Photo upload (multiple)
- Private toggle with explanation text

- [ ] **Step 5: Create status timeline component**

- Vertical timeline showing status changes with dates
- Each step: status label, date, who changed it

- [ ] **Step 6: Add i18n keys and commit**

```bash
git commit -m "feat: complaints UI — list, detail, status tracking, notes"
```

---

## Task 10: Sidebar Navigation Update

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/i18n/en.json`, `src/i18n/hu.json`

- [ ] **Step 1: Add complaints to sidebar navigation**

The sidebar already has entries for announcements, forum, and messages. Add a "Complaints" entry:
- Icon: `AlertTriangle` or `FileWarning` from lucide-react
- Href: `/complaints`
- Min role: TENANT

- [ ] **Step 2: Verify all Communication nav items work**

- /announcements → announcement list
- /forum → forum page
- /messages → messaging page
- /complaints → complaints list

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: update sidebar with complaints navigation"
```

---

## Summary

| Task | Issues | Description |
|------|--------|-------------|
| 1 | #13,15,17,19 | Communication database schema + migration |
| 2 | #13 | Announcements API |
| 3 | #14 | Announcements UI (Stitch design) |
| 4 | #15 | Forum API |
| 5 | #16 | Forum UI (Stitch design) |
| 6 | #17 | Direct Messaging API |
| 7 | #18 | Direct Messaging UI |
| 8 | #19 | Complaints API |
| 9 | #20 | Complaints UI |
| 10 | — | Sidebar navigation update |
