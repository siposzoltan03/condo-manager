import { prisma } from "@/lib/prisma";

export async function getContractorWithStats(id: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { id },
    include: {
      tickets: {
        include: {
          reporter: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      ratings: {
        include: {
          rater: { select: { id: true, name: true } },
          ticket: { select: { id: true, trackingNumber: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!contractor) return null;

  const avgRating =
    contractor.ratings.length > 0
      ? contractor.ratings.reduce((sum, r) => sum + r.rating, 0) /
        contractor.ratings.length
      : null;

  const completedJobs = contractor.tickets.filter(
    (t) => t.status === "COMPLETED" || t.status === "VERIFIED"
  ).length;

  return {
    ...contractor,
    averageRating: avgRating,
    completedJobs,
  };
}
