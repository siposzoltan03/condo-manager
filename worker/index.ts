import { Worker } from "bullmq";
import Redis from "ioredis";
import { processNotificationJob } from "./jobs";
import { processVotingJob } from "./processors/voting";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    console.log(`Processing notification job ${job.id}: ${job.name}`);
    await processNotificationJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

notificationWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

notificationWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

const votingWorker = new Worker(
  "voting",
  async (job) => {
    console.log(`Processing voting job ${job.id}: ${job.name}`);
    await processVotingJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

votingWorker.on("completed", (job) => {
  console.log(`Voting job ${job.id} completed successfully`);
});

votingWorker.on("failed", (job, err) => {
  console.error(`Voting job ${job?.id} failed:`, err.message);
});

const scheduledWorker = new Worker(
  "scheduled",
  async (job) => {
    // TODO: implement scheduled job processors (e.g. reminders, reports)
    console.log(`Processing scheduled job ${job.id}: ${job.name}`);
  },
  {
    connection,
    concurrency: 5,
  }
);

scheduledWorker.on("completed", (job) => {
  console.log(`Scheduled job ${job.id} completed successfully`);
});

scheduledWorker.on("failed", (job, err) => {
  console.error(`Scheduled job ${job?.id} failed:`, err.message);
});

console.log(
  "Worker started, listening for jobs on 'notifications', 'voting', and 'scheduled' queues..."
);

const shutdown = async () => {
  console.log("Shutting down worker...");
  await notificationWorker.close();
  await votingWorker.close();
  await scheduledWorker.close();
  await connection.quit();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
