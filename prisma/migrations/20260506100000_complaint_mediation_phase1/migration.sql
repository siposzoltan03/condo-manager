-- Reshape Complaint into a mediation/házirend-violation tracker.
-- Tables Complaint and ComplaintNote were emptied beforehand, so the
-- enum / column drops are safe.

-- ─── 1. ComplaintStatus enum: replace with new values ─────────────────────
ALTER TYPE "ComplaintStatus" RENAME TO "ComplaintStatus_old";

CREATE TYPE "ComplaintStatus" AS ENUM (
  'REPORTED',
  'ACKNOWLEDGED',
  'WARNING_SENT',
  'MEDIATION',
  'RESOLVED',
  'ESCALATED'
);

ALTER TABLE "Complaint"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ComplaintStatus" USING (
    CASE "status"::text
      WHEN 'SUBMITTED'    THEN 'REPORTED'::"ComplaintStatus"
      WHEN 'UNDER_REVIEW' THEN 'ACKNOWLEDGED'::"ComplaintStatus"
      WHEN 'IN_PROGRESS'  THEN 'MEDIATION'::"ComplaintStatus"
      WHEN 'RESOLVED'     THEN 'RESOLVED'::"ComplaintStatus"
      WHEN 'REJECTED'     THEN 'ESCALATED'::"ComplaintStatus"
      ELSE 'REPORTED'::"ComplaintStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'REPORTED';

DROP TYPE "ComplaintStatus_old";

-- ─── 2. ComplaintCategory: enum → table ───────────────────────────────────
-- Drop the old enum-typed column first so the type isn't held open.
ALTER TABLE "Complaint" DROP COLUMN "category";
DROP TYPE "ComplaintCategory";

CREATE TABLE "ComplaintCategory" (
  "id"         TEXT      NOT NULL PRIMARY KEY,
  "buildingId" TEXT      NOT NULL,
  "slug"       TEXT      NOT NULL,
  "name"       TEXT      NOT NULL,
  "icon"       TEXT,
  "sortOrder"  INTEGER   NOT NULL DEFAULT 0,
  "isDefault"  BOOLEAN   NOT NULL DEFAULT false,
  "isActive"   BOOLEAN   NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP NOT NULL,
  CONSTRAINT "ComplaintCategory_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ComplaintCategory_buildingId_slug_key"
  ON "ComplaintCategory"("buildingId", "slug");
CREATE INDEX "ComplaintCategory_buildingId_isActive_idx"
  ON "ComplaintCategory"("buildingId", "isActive");

-- ─── 3. Complaint: add new fields ─────────────────────────────────────────
ALTER TABLE "Complaint"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "categoryId" TEXT NOT NULL,
  ADD COLUMN "respondentUnitId" TEXT,
  ADD COLUMN "escalatedMeetingId" TEXT;

ALTER TABLE "Complaint"
  ALTER COLUMN "isPrivate" SET DEFAULT true;

CREATE INDEX "Complaint_categoryId_idx" ON "Complaint"("categoryId");
CREATE INDEX "Complaint_respondentUnitId_idx" ON "Complaint"("respondentUnitId");
CREATE INDEX "Complaint_escalatedMeetingId_idx" ON "Complaint"("escalatedMeetingId");

ALTER TABLE "Complaint"
  ADD CONSTRAINT "Complaint_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ComplaintCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Complaint_respondentUnitId_fkey"
    FOREIGN KEY ("respondentUnitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Complaint_escalatedMeetingId_fkey"
    FOREIGN KEY ("escalatedMeetingId") REFERENCES "Meeting"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. ComplaintStatusEvent: status-transition timeline ──────────────────
CREATE TABLE "ComplaintStatusEvent" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "complaintId" TEXT NOT NULL,
  "fromStatus"  "ComplaintStatus",
  "toStatus"    "ComplaintStatus" NOT NULL,
  "actorId"     TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplaintStatusEvent_complaintId_fkey"
    FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ComplaintStatusEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ComplaintStatusEvent_complaintId_createdAt_idx"
  ON "ComplaintStatusEvent"("complaintId", "createdAt");
