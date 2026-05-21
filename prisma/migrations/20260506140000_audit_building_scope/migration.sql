-- Building-scope the audit log. Existing rows stay null; new writes
-- pass the active buildingId. The GET endpoint filters to
-- (callerBuildingId OR null) so historical rows remain visible to admins.

ALTER TABLE "AuditLog" ADD COLUMN "buildingId" TEXT;

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditLog_buildingId_idx" ON "AuditLog"("buildingId");
