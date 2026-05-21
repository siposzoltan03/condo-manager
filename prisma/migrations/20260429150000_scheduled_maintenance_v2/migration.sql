-- Replace free-text recurrence with structured month interval, add lead time
-- and materialization tracking. Add ticket→schedule link.

ALTER TABLE "ScheduledMaintenance" DROP COLUMN "recurrenceRule";
ALTER TABLE "ScheduledMaintenance" ADD COLUMN "recurrenceMonths" INTEGER;
ALTER TABLE "ScheduledMaintenance" ADD COLUMN "leadTimeDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "ScheduledMaintenance" ADD COLUMN "materializedAt" TIMESTAMP(3);

ALTER TABLE "MaintenanceTicket" ADD COLUMN "scheduledMaintenanceId" TEXT;
ALTER TABLE "MaintenanceTicket"
  ADD CONSTRAINT "MaintenanceTicket_scheduledMaintenanceId_fkey"
  FOREIGN KEY ("scheduledMaintenanceId")
  REFERENCES "ScheduledMaintenance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MaintenanceTicket_scheduledMaintenanceId_idx" ON "MaintenanceTicket"("scheduledMaintenanceId");
