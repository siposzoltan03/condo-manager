import { prisma } from "@/lib/prisma";

export async function getScheduledMaintenanceList() {
  return prisma.scheduledMaintenance.findMany({
    orderBy: { date: "asc" },
  });
}
