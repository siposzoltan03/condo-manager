-- Add SLA tracking field to maintenance tickets
ALTER TABLE "MaintenanceTicket" ADD COLUMN "slaHours" INTEGER;
