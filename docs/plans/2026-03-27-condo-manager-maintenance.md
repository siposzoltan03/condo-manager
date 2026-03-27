# Condo Manager — Maintenance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Maintenance module — ticket reporting, status workflow, contractor assignment, scheduled maintenance.

**Architecture:** Extends the Foundation with maintenance models. Residents report issues with urgency/category. Board/admin manages workflow (Submitted → Acknowledged → Assigned → In Progress → Completed → Verified). Contractors are assigned per ticket. Scheduled maintenance is tracked separately.

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, BullMQ, Tailwind CSS, lucide-react, next-intl

**Spec:** `docs/superpowers/specs/2026-03-25-condo-manager-design.md`
**Design refs:** `docs/reference/stitch-maintenance-design.md`
**GitHub Issues:** #26–#29 in `siposzoltan03/condo-manager`

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── maintenance/
│   │       ├── tickets/
│   │       │   ├── route.ts                        # GET list (filtered, paginated), POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts                    # GET detail, PATCH update status
│   │       │       ├── comments/
│   │       │       │   └── route.ts                # GET list, POST add comment
│   │       │       ├── assign/
│   │       │       │   └── route.ts                # POST assign contractor
│   │       │       └── rate/
│   │       │           └── route.ts                # POST rate contractor
│   │       ├── contractors/
│   │       │   ├── route.ts                        # GET list, POST create (admin)
│   │       │   └── [id]/
│   │       │       └── route.ts                    # GET detail, PATCH update, DELETE (admin)
│   │       └── scheduled/
│   │           ├── route.ts                        # GET list, POST create (board+)
│   │           └── [id]/
│   │               └── route.ts                    # PATCH update, DELETE (board+)
│   └── [locale]/
│       └── maintenance/
│           ├── page.tsx                            # Ticket list (all roles)
│           ├── [id]/
│           │   └── page.tsx                        # Ticket detail + comments
│           ├── contractors/
│           │   └── page.tsx                        # Contractor list/detail (admin/board)
│           └── scheduled/
│               └── page.tsx                        # Scheduled maintenance calendar (admin/board)
├── components/
│   └── maintenance/
│       ├── TicketList.tsx                          # Filterable ticket list with urgency badges
│       ├── TicketRow.tsx                           # Single ticket row (12-col grid)
│       ├── TicketFilterBar.tsx                     # Search + status/urgency/category dropdowns
│       ├── ReportIssueModal.tsx                    # Create ticket form modal
│       ├── TicketDetail.tsx                        # Full ticket detail view
│       ├── StatusTimeline.tsx                      # Vertical status workflow timeline
│       ├── CommentsThread.tsx                      # Chronological comments + add form
│       ├── ContractorList.tsx                      # Contractor list with ratings
│       ├── ContractorDetail.tsx                    # Contractor detail + rating form
│       └── ScheduledMaintenanceCalendar.tsx        # Calendar/list view of scheduled items
└── lib/
    └── maintenance/
        ├── tickets.ts                              # Ticket query helpers + tracking number gen
        ├── contractors.ts                          # Contractor query helpers
        └── scheduled.ts                            # Scheduled maintenance query helpers
prisma/
└── schema.prisma                                   # Extended with maintenance models
messages/
├── en.json                                         # maintenance.* i18n keys added
└── nl.json                                         # maintenance.* i18n keys added
```

---

## Task 1: Maintenance Database Schema (Issue #26)

**Commit message:** `feat(maintenance): add Maintenance schema — MaintenanceTicket, Contractor, ScheduledMaintenance`

### Steps

- [ ] Open `prisma/schema.prisma`
- [ ] Add `MaintenanceCategory` enum:
  ```prisma
  enum MaintenanceCategory {
    PLUMBING
    ELECTRICAL
    STRUCTURAL
    COMMON_AREA
    ELEVATOR
    HEATING
    OTHER
  }
  ```
- [ ] Add `Urgency` enum:
  ```prisma
  enum Urgency {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }
  ```
- [ ] Add `TicketStatus` enum:
  ```prisma
  enum TicketStatus {
    SUBMITTED
    ACKNOWLEDGED
    ASSIGNED
    IN_PROGRESS
    COMPLETED
    VERIFIED
  }
  ```
- [ ] Add `MaintenanceTicket` model:
  ```prisma
  model MaintenanceTicket {
    id                    String              @id @default(cuid())
    reporterId            String
    reporter              User                @relation("MaintenanceTickets", fields: [reporterId], references: [id])
    title                 String
    description           String              @db.Text
    category              MaintenanceCategory
    location              String?
    urgency               Urgency
    status                TicketStatus        @default(SUBMITTED)
    trackingNumber        String              @unique
    assignedContractorId  String?
    assignedContractor    Contractor?         @relation(fields: [assignedContractorId], references: [id])
    comments              TicketComment[]
    attachments           TicketAttachment[]
    ratings               ContractorRating[]
    createdAt             DateTime            @default(now())
    updatedAt             DateTime            @updatedAt

    @@index([status])
    @@index([reporterId])
    @@index([createdAt])
  }
  ```
- [ ] Add `TicketComment` model:
  ```prisma
  model TicketComment {
    id         String             @id @default(cuid())
    ticketId   String
    ticket     MaintenanceTicket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
    authorId   String
    author     User               @relation("TicketComments", fields: [authorId], references: [id])
    body       String             @db.Text
    isInternal Boolean            @default(false)
    createdAt  DateTime           @default(now())

    @@index([ticketId, createdAt])
  }
  ```
- [ ] Add `TicketAttachment` model:
  ```prisma
  model TicketAttachment {
    id        String             @id @default(cuid())
    ticketId  String
    ticket    MaintenanceTicket  @relation(fields: [ticketId], references: [id], onDelete: Cascade)
    fileUrl   String
    fileName  String
    createdAt DateTime           @default(now())
  }
  ```
- [ ] Add `Contractor` model:
  ```prisma
  model Contractor {
    id          String             @id @default(cuid())
    name        String
    specialty   String
    contactInfo String
    taxId       String?
    tickets     MaintenanceTicket[]
    ratings     ContractorRating[]
    createdAt   DateTime           @default(now())
  }
  ```
- [ ] Add `ContractorRating` model:
  ```prisma
  model ContractorRating {
    id           String             @id @default(cuid())
    contractorId String
    contractor   Contractor         @relation(fields: [contractorId], references: [id])
    ticketId     String
    ticket       MaintenanceTicket  @relation(fields: [ticketId], references: [id])
    raterId      String
    rater        User               @relation("ContractorRatings", fields: [raterId], references: [id])
    rating       Int
    notes        String?
    createdAt    DateTime           @default(now())
  }
  ```
- [ ] Add `ScheduledMaintenance` model:
  ```prisma
  model ScheduledMaintenance {
    id              String   @id @default(cuid())
    title           String
    description     String?
    date            DateTime
    isRecurring     Boolean  @default(false)
    recurrenceRule  String?
    createdAt       DateTime @default(now())
  }
  ```
- [ ] Add relations to `User` model:
  - `maintenanceTickets   MaintenanceTicket[]  @relation("MaintenanceTickets")`
  - `ticketComments       TicketComment[]      @relation("TicketComments")`
  - `contractorRatings    ContractorRating[]   @relation("ContractorRatings")`
- [ ] Update `prisma/seed.ts` to seed sample contractors and a scheduled maintenance entry
- [ ] Run `npx prisma migrate dev --name add-maintenance-schema`
- [ ] Run `npx prisma db seed` to verify seed works
- [ ] Commit: `feat(maintenance): add Maintenance schema — MaintenanceTicket, Contractor, ScheduledMaintenance`

---

## Task 2: Maintenance Ticket API (Issue #27)

**Commit message:** `feat(maintenance): ticket API — CRUD, status workflow, comments, contractor assignment`

### Endpoints

| Method | Path                                          | Description                                               | Auth              |
|--------|-----------------------------------------------|-----------------------------------------------------------|-------------------|
| GET    | /api/maintenance/tickets                      | List tickets (filter by status/urgency/category, paginated) | Authenticated   |
| POST   | /api/maintenance/tickets                      | Create ticket (auto-generate MNT-YYYY-NNN tracking number) | Authenticated   |
| GET    | /api/maintenance/tickets/[id]                 | Get ticket detail                                         | Authenticated     |
| PATCH  | /api/maintenance/tickets/[id]                 | Update status (workflow enforced) + audit log             | Board+/Admin      |
| GET    | /api/maintenance/tickets/[id]/comments        | List comments (internal filtered for non-admin)           | Authenticated     |
| POST   | /api/maintenance/tickets/[id]/comments        | Add comment (isInternal for admin only)                   | Authenticated     |
| GET    | /api/maintenance/contractors                  | List contractors                                          | Admin/Board       |
| POST   | /api/maintenance/contractors                  | Create contractor                                         | Admin only        |
| PATCH  | /api/maintenance/contractors/[id]             | Update contractor                                         | Admin only        |
| DELETE | /api/maintenance/contractors/[id]             | Delete contractor                                         | Admin only        |
| POST   | /api/maintenance/tickets/[id]/assign          | Assign contractor to ticket                               | Board+/Admin      |
| POST   | /api/maintenance/tickets/[id]/rate            | Rate contractor after completion                          | Admin only        |
| GET    | /api/maintenance/scheduled                    | List scheduled maintenance                                | Board+/Admin      |
| POST   | /api/maintenance/scheduled                    | Create scheduled maintenance entry                        | Board+/Admin      |
| PATCH  | /api/maintenance/scheduled/[id]               | Update scheduled maintenance entry                        | Board+/Admin      |
| DELETE | /api/maintenance/scheduled/[id]               | Delete scheduled maintenance entry                        | Board+/Admin      |

### Steps

- [ ] Create `src/app/api/maintenance/tickets/route.ts`
  - GET: filter by `status`, `urgency`, `category` query params. Paginated. Residents see own tickets; admin/board see all.
  - POST: any authenticated user. Auto-generate tracking number `MNT-YYYY-NNN` (query last sequence for year, increment, retry on unique conflict).
- [ ] Create `src/app/api/maintenance/tickets/[id]/route.ts`
  - GET: return ticket with reporter, contractor, attachments.
  - PATCH: enforce status workflow (SUBMITTED→ACKNOWLEDGED→ASSIGNED→IN_PROGRESS→COMPLETED→VERIFIED). Send notification on status change. Write audit log entry.
- [ ] Create `src/app/api/maintenance/tickets/[id]/comments/route.ts`
  - GET: return comments; filter out `isInternal: true` for non-admin/board users.
  - POST: authenticated. Only admin/board may set `isInternal: true`.
- [ ] Create `src/app/api/maintenance/contractors/route.ts` and `[id]/route.ts`
  - Full CRUD, admin only for mutations.
- [ ] Create `src/app/api/maintenance/tickets/[id]/assign/route.ts`
  - POST: board+ only. Set `assignedContractorId`. Transition status to ASSIGNED if currently ACKNOWLEDGED. Write audit log.
- [ ] Create `src/app/api/maintenance/tickets/[id]/rate/route.ts`
  - POST: admin only. Ticket must be COMPLETED or VERIFIED. Create `ContractorRating` record.
- [ ] Create `src/app/api/maintenance/scheduled/route.ts` and `[id]/route.ts`
  - Full CRUD, board+ only.
- [ ] Create `src/lib/maintenance/tickets.ts`: tracking number generation helper with retry logic.
- [ ] Apply role guards using existing `withAuth` / session check pattern.
- [ ] Commit: `feat(maintenance): ticket API — CRUD, status workflow, comments, contractor assignment`

---

## Task 3: Maintenance Tickets UI (Issue #28)

**Commit message:** `feat(maintenance): ticket list, detail, comments, and report issue form`

### Steps

- [ ] Create `src/app/[locale]/maintenance/page.tsx`
  - Server component: fetch ticket list for current user (or all, for admin/board).
  - Pass data to `TicketList` client component.
- [ ] Create `src/components/maintenance/TicketFilterBar.tsx`
  - Container: bg-surface-container-low, rounded-xl, p-6.
  - Search input (text filter on title/tracking number).
  - Status dropdown: All / Submitted / Acknowledged / Assigned / In Progress / Completed.
  - Urgency dropdown: All / Low / Medium / High / Critical.
  - Category dropdown: All / HVAC / Plumbing / Electrical / Structural / Common Areas.
- [ ] Create `src/components/maintenance/TicketRow.tsx`
  - White card (rounded-xl, p-5, hover:shadow-xl).
  - Left urgency badge: Critical (bg-error-container text-on-error-container, emergency icon), High (bg-orange-50 text-orange-800, border-l-4 border-orange-400), Medium (bg-secondary-container text-on-secondary-container, border-l-4), Low (bg-surface-container text-on-surface-variant).
  - 12-col grid: tracking + title + category icon (col-span-4), reporter avatar + name (col-span-3), contractor name or "Unassigned" (col-span-3), status badge + date (col-span-2), chevron_right.
  - Status badges: In Progress (bg-surface-container-high text-primary), Submitted (bg-surface-container), Acknowledged (bg-blue-100 text-blue-800), Completed (bg-green-100 text-green-800).
- [ ] Create `src/components/maintenance/TicketList.tsx`
  - Renders `TicketFilterBar` + list of `TicketRow`.
  - Client-side filter by search, status, urgency, category.
- [ ] Create `src/components/maintenance/ReportIssueModal.tsx`
  - Fields: Title, Description (textarea), Category (select), Urgency (select), Location (optional text), Attachments (file upload).
  - POST to `/api/maintenance/tickets` on submit.
  - Show generated tracking number in success state.
- [ ] Create `src/app/[locale]/maintenance/[id]/page.tsx`
  - Server component: fetch ticket detail, comments, attachments.
  - Pass data to `TicketDetail` client component.
- [ ] Create `src/components/maintenance/TicketDetail.tsx`
  - Full description + attachment gallery.
  - Tracking number, category badge, urgency badge.
  - Renders `StatusTimeline` and `CommentsThread`.
  - Admin/board: show status PATCH controls and contractor assignment.
- [ ] Create `src/components/maintenance/StatusTimeline.tsx`
  - Vertical timeline (left border line).
  - Each status change: colored dot + status label + date + changed by.
  - Current status highlighted.
- [ ] Create `src/components/maintenance/CommentsThread.tsx`
  - Chronological comments list.
  - Public comments: white bg card.
  - Internal comments (admin/board only): bg-amber-50 border-l-4 border-amber-400 with "Internal" badge.
  - Add comment form: textarea, "Internal note" toggle (admin only), Submit button.
- [ ] Add i18n keys to `messages/en.json` and `messages/nl.json` under `maintenance.*`:
  - `maintenance.title`, `maintenance.reportIssue`, `maintenance.search`, `maintenance.filterStatus`,
  - `maintenance.filterUrgency`, `maintenance.filterCategory`, `maintenance.unassigned`,
  - `maintenance.trackingNumber`, `maintenance.reporter`, `maintenance.contractor`,
  - `maintenance.status.submitted`, `maintenance.status.acknowledged`, `maintenance.status.assigned`,
  - `maintenance.status.inProgress`, `maintenance.status.completed`, `maintenance.status.verified`,
  - `maintenance.urgency.low`, `maintenance.urgency.medium`, `maintenance.urgency.high`, `maintenance.urgency.critical`,
  - `maintenance.category.plumbing`, `maintenance.category.electrical`, `maintenance.category.structural`,
  - `maintenance.category.commonArea`, `maintenance.category.elevator`, `maintenance.category.heating`, `maintenance.category.other`,
  - `maintenance.comments.addComment`, `maintenance.comments.internalNote`, `maintenance.comments.internalWarning`
- [ ] Commit: `feat(maintenance): ticket list, detail, comments, and report issue form`

---

## Task 4: Contractor & Scheduled Maintenance UI (Issue #29)

**Commit message:** `feat(maintenance): contractor list/detail, rating form, scheduled maintenance calendar`

### Steps

- [ ] Create `src/app/[locale]/maintenance/contractors/page.tsx`
  - Server component with role guard (admin/board only).
  - Fetch contractor list with average ratings.
  - Pass data to `ContractorList`.
- [ ] Create `src/components/maintenance/ContractorList.tsx`
  - Card grid of contractors: name, specialty, contact info, average star rating, number of completed jobs.
  - "Add Contractor" button (admin only) opens inline form or modal.
- [ ] Create `src/components/maintenance/ContractorDetail.tsx`
  - Full contractor info + list of assigned tickets.
  - Rating history with notes.
  - Rating form (admin only): 1–5 stars + optional notes. POST to `/api/maintenance/tickets/[id]/rate`.
- [ ] Create `src/app/[locale]/maintenance/scheduled/page.tsx`
  - Server component with role guard (board+ only).
  - Fetch scheduled maintenance entries.
  - Pass data to `ScheduledMaintenanceCalendar`.
- [ ] Create `src/components/maintenance/ScheduledMaintenanceCalendar.tsx`
  - Calendar/list toggle view.
  - List view: rows with date, title, recurrence badge, edit/delete actions.
  - Calendar view: simple month grid highlighting days with scheduled events.
  - "Add Scheduled Maintenance" form: Title, Description, Date, Is Recurring toggle, Recurrence Rule (text, e.g. "Every 3 months"). POST to `/api/maintenance/scheduled`.
- [ ] Add i18n keys under `maintenance.contractors.*` and `maintenance.scheduled.*`:
  - `maintenance.contractors.title`, `maintenance.contractors.addContractor`, `maintenance.contractors.specialty`,
  - `maintenance.contractors.contactInfo`, `maintenance.contractors.averageRating`, `maintenance.contractors.completedJobs`,
  - `maintenance.scheduled.title`, `maintenance.scheduled.addEntry`, `maintenance.scheduled.date`,
  - `maintenance.scheduled.isRecurring`, `maintenance.scheduled.recurrenceRule`, `maintenance.scheduled.listView`, `maintenance.scheduled.calendarView`
- [ ] Commit: `feat(maintenance): contractor list/detail, rating form, scheduled maintenance calendar`

---

## Task 5: Navigation Update

**Commit message:** `feat(maintenance): update sidebar navigation for Maintenance module`

### Steps

- [ ] Locate sidebar component (likely `src/components/layout/Sidebar.tsx` or similar).
- [ ] Verify the existing Maintenance nav item links correctly to `/maintenance`.
- [ ] For admin/board roles, add sub-navigation links:
  - Contractors: `/maintenance/contractors` (admin/board only)
  - Scheduled: `/maintenance/scheduled` (board+ only)
- [ ] Add i18n keys: `nav.maintenanceContractors`, `nav.maintenanceScheduled`
- [ ] Commit: `feat(maintenance): update sidebar navigation for Maintenance module`

---

## Summary

| Task | Issue | Description                                |
|------|-------|--------------------------------------------|
| 1    | #26   | Maintenance Database Schema                |
| 2    | #27   | Maintenance Ticket API                     |
| 3    | #28   | Maintenance Tickets UI                     |
| 4    | #29   | Contractor & Scheduled Maintenance UI      |
| 5    | —     | Navigation Update                          |

Run tasks sequentially: schema → API → UI. Task 2 (API) must complete before Tasks 3 and 4 (UIs). Tasks 3 and 4 can be done in parallel after Task 2.
