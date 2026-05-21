-- Add explicit stairwell + position-on-floor for floor-map rendering.
ALTER TABLE "Unit" ADD COLUMN "stairwell" TEXT;
ALTER TABLE "Unit" ADD COLUMN "positionOnFloor" INTEGER;

CREATE INDEX "Unit_buildingId_stairwell_floor_positionOnFloor_idx"
  ON "Unit"("buildingId", "stairwell", "floor", "positionOnFloor");
