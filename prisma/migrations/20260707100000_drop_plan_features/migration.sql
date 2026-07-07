-- Retire the dead Plan.features JSON column. Plan↔feature membership now
-- lives entirely in the PlanFeature matrix (superadmin console + resolver);
-- the public pricing list is derived from it in /api/plans.
ALTER TABLE "Plan" DROP COLUMN "features";
