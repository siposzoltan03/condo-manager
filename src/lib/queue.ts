import { Queue } from "bullmq";
import { redis } from "./redis";

export const notificationsQueue = new Queue("notifications", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const scheduledQueue = new Queue("scheduled", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const votingQueue = new Queue("voting", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const reportsQueue = new Queue("reports", {
  connection: redis,
  defaultJobOptions: {
    // PDF generation is deterministic — one retry on transient errors
    // (Redis hiccup, R2 timeout) is plenty.
    attempts: 2,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const szmszQueue = new Queue("szmsz", {
  connection: redis,
  defaultJobOptions: {
    // AI extraction is billed per call — no auto-retry (failures surface to the
    // user, who can re-upload). Long-running (up to a couple of minutes).
    attempts: 1,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});
