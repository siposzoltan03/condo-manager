-- Cross-cutting pending-agenda queue. Replaces the direct meeting FK on
-- Complaint and BoardResignation with a polymorphic PendingAgendaItem row.

-- ─── 1. Enum ─────────────────────────────────────────────────────────────
CREATE TYPE "PendingAgendaKind" AS ENUM (
  'COMPLAINT_ESCALATION',
  'BOARD_RESIGNATION'
);

-- ─── 2. Table ────────────────────────────────────────────────────────────
CREATE TABLE "PendingAgendaItem" (
  "id"                TEXT              NOT NULL PRIMARY KEY,
  "buildingId"        TEXT              NOT NULL,
  "kind"              "PendingAgendaKind" NOT NULL,
  "title"             TEXT              NOT NULL,
  "description"       TEXT,
  "complaintId"       TEXT,
  "resignationId"     TEXT,
  "createdById"       TEXT              NOT NULL,
  "attachedMeetingId" TEXT,
  "resolutionNote"    TEXT,
  "resolvedAt"        TIMESTAMP,
  "resolvedById"      TEXT,
  "createdAt"         TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP         NOT NULL,
  CONSTRAINT "PendingAgendaItem_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PendingAgendaItem_complaintId_fkey"
    FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PendingAgendaItem_resignationId_fkey"
    FOREIGN KEY ("resignationId") REFERENCES "BoardResignation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PendingAgendaItem_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PendingAgendaItem_attachedMeetingId_fkey"
    FOREIGN KEY ("attachedMeetingId") REFERENCES "Meeting"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PendingAgendaItem_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PendingAgendaItem_complaintId_key"
  ON "PendingAgendaItem"("complaintId");
CREATE UNIQUE INDEX "PendingAgendaItem_resignationId_key"
  ON "PendingAgendaItem"("resignationId");
CREATE INDEX "PendingAgendaItem_buildingId_attachedMeetingId_idx"
  ON "PendingAgendaItem"("buildingId", "attachedMeetingId");
CREATE INDEX "PendingAgendaItem_attachedMeetingId_idx"
  ON "PendingAgendaItem"("attachedMeetingId");
CREATE INDEX "PendingAgendaItem_resolvedAt_idx"
  ON "PendingAgendaItem"("resolvedAt");

-- ─── 3. Backfill from existing FKs ───────────────────────────────────────
-- Every escalated complaint becomes a pending agenda item already attached
-- to its meeting. createdById defaults to the complaint author for lack
-- of a better proxy (the actual escalator is in the audit log).
INSERT INTO "PendingAgendaItem" (
  "id",
  "buildingId",
  "kind",
  "title",
  "description",
  "complaintId",
  "createdById",
  "attachedMeetingId",
  "createdAt",
  "updatedAt"
)
SELECT
  'pai_' || c."id",
  c."buildingId",
  'COMPLAINT_ESCALATION'::"PendingAgendaKind",
  COALESCE(c."title", c."trackingNumber"),
  LEFT(c."description", 280),
  c."id",
  c."authorId",
  c."escalatedMeetingId",
  c."updatedAt",
  CURRENT_TIMESTAMP
FROM "Complaint" c
WHERE c."escalatedMeetingId" IS NOT NULL;

-- Existing resignations: BoardResignation.meetingId was an unfilled column
-- in practice, but we backfill if anything's there.
INSERT INTO "PendingAgendaItem" (
  "id",
  "buildingId",
  "kind",
  "title",
  "description",
  "resignationId",
  "createdById",
  "attachedMeetingId",
  "createdAt",
  "updatedAt"
)
SELECT
  'pai_' || r."id",
  ub."buildingId",
  'BOARD_RESIGNATION'::"PendingAgendaKind",
  'Lemondás: ' || COALESCE(u."name", 'képviselő'),
  r."reason",
  r."id",
  ub."userId",
  r."meetingId",
  r."submittedAt",
  CURRENT_TIMESTAMP
FROM "BoardResignation" r
JOIN "UserBuilding" ub ON ub."id" = r."userBuildingId"
JOIN "User" u ON u."id" = ub."userId"
WHERE r."meetingId" IS NOT NULL;

-- ─── 4. Drop the old direct FKs ─────────────────────────────────────────
ALTER TABLE "Complaint"
  DROP CONSTRAINT IF EXISTS "Complaint_escalatedMeetingId_fkey";
DROP INDEX IF EXISTS "Complaint_escalatedMeetingId_idx";
ALTER TABLE "Complaint" DROP COLUMN "escalatedMeetingId";

ALTER TABLE "BoardResignation"
  DROP CONSTRAINT IF EXISTS "BoardResignation_meetingId_fkey";
ALTER TABLE "BoardResignation" DROP COLUMN "meetingId";
