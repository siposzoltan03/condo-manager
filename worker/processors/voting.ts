import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function processVotingJob(job: Job): Promise<void> {
  switch (job.name) {
    case "vote-auto-close": {
      const { voteId } = job.data as { voteId: string };

      const vote = await prisma.vote.findUnique({
        where: { id: voteId },
        select: { id: true, status: true, title: true, deadline: true },
      });

      if (!vote) {
        console.warn(`Vote ${voteId} not found; skipping auto-close.`);
        break;
      }

      if (vote.status !== "OPEN") {
        console.log(`Vote ${voteId} is already ${vote.status}; skipping auto-close.`);
        break;
      }

      // Close the vote
      await prisma.vote.update({
        where: { id: voteId },
        data: { status: "CLOSED" },
      });

      console.log(`Vote ${voteId} ("${vote.title}") auto-closed at deadline.`);

      // Send notifications to all active users
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (users.length > 0) {
        await prisma.$transaction(
          users.map((u) =>
            prisma.notification.create({
              data: {
                userId: u.id,
                type: "VOTE_CLOSING",
                title: `Vote Closed: ${vote.title}`,
                body: `The vote "${vote.title}" has been closed. Results are now available.`,
                entityType: "Vote",
                entityId: voteId,
              },
            })
          )
        );
      }

      break;
    }

    default:
      console.warn(`Unknown voting job type: ${job.name}`);
  }
}
