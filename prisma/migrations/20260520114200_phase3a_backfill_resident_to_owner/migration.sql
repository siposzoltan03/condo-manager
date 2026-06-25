-- Phase 3a — Tht. § 16 backfill. Move every UserBuilding membership from
-- the deprecated RESIDENT role to OWNER. RESIDENT is dropped in 3b once
-- this migration applies cleanly and the code sweep is committed.
UPDATE "UserBuilding" SET "role" = 'OWNER' WHERE "role" = 'RESIDENT';
