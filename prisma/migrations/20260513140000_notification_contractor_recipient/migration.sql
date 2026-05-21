-- Phase 5/6 follow-up: let contractor users receive in-app notifications.
-- Notification.userId becomes nullable; a new contractorUserId column is
-- added with the corresponding FK + index. App code enforces that exactly
-- one of the two recipient columns is set per row.

ALTER TABLE "Notification" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Notification" ADD COLUMN "contractorUserId" TEXT;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_contractorUserId_fkey"
  FOREIGN KEY ("contractorUserId")
  REFERENCES "ContractorUser" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE INDEX "Notification_contractorUserId_isRead_idx"
  ON "Notification" ("contractorUserId", "isRead");
