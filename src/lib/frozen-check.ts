import { prisma } from "./prisma";

/**
 * Custom error thrown when a write operation is attempted on a frozen building.
 */
export class FrozenBuildingError extends Error {
  constructor(buildingId: string) {
    super(
      `Building ${buildingId} is frozen due to plan limits. Upgrade your plan or remove excess buildings.`
    );
    this.name = "FrozenBuildingError";
  }
}

/**
 * Checks if a building is frozen (due to plan downgrade exceeding limits).
 * Throws FrozenBuildingError if the building is frozen.
 * Call this at the start of POST/PATCH/DELETE handlers for building-scoped routes.
 */
export async function requireNotFrozen(buildingId: string): Promise<void> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { isFrozen: true },
  });

  if (building?.isFrozen) {
    throw new FrozenBuildingError(buildingId);
  }
}

/**
 * Returns the count of frozen buildings for a subscription.
 */
export async function getFrozenBuildingCount(
  subscriptionId: string
): Promise<number> {
  return prisma.building.count({
    where: { subscriptionId, isFrozen: true },
  });
}

/**
 * Returns frozen building details for a subscription.
 */
export async function getFrozenBuildings(subscriptionId: string) {
  return prisma.building.findMany({
    where: { subscriptionId, isFrozen: true },
    select: { id: true, name: true, address: true },
  });
}
