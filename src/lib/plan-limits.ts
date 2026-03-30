import { prisma } from "./prisma";
import { getPlanForBuilding } from "./feature-gate";

/**
 * Checks whether the subscription is allowed to add another building.
 * Returns the current count, maximum allowed, and whether adding is permitted.
 * A max of -1 means unlimited.
 */
export async function checkBuildingLimit(
  subscriptionId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, buildings: { select: { id: true } } },
  });

  if (!sub) return { allowed: false, current: 0, max: 0 };

  const max = sub.plan.maxBuildings;
  const current = sub.buildings.length;

  return { allowed: max === -1 || current < max, current, max };
}

/**
 * Checks whether the building is allowed to add another unit.
 * Returns the current count, maximum allowed, and whether adding is permitted.
 * A max of -1 means unlimited.
 */
export async function checkUnitLimit(
  buildingId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const plan = await getPlanForBuilding(buildingId);

  if (!plan) return { allowed: false, current: 0, max: 0 };

  const current = await prisma.unit.count({ where: { buildingId } });
  const max = plan.maxUnitsPerBuilding;

  return { allowed: max === -1 || current < max, current, max };
}
