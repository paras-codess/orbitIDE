import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// ------------------------------------
// Parse REDIS_URL for BullMQ IORedis options
// BullMQ requires a raw IORedis config object, not a URL string.
// ------------------------------------
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const parsedUrl = new URL(redisUrl);

const connection = {
  host: parsedUrl.hostname,
  port: parseInt(parsedUrl.port, 10) || 6379,
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  username: parsedUrl.username || undefined,
  tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
};

// ------------------------------------
// Submission Queue Definition
// ------------------------------------
const submissionQueue = new Queue("submission-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 500 },  // keep last 500 completed jobs
    removeOnFail: { count: 200 },       // keep last 200 failed jobs
  },
});

submissionQueue.on("error", (err) => {
  console.error("❌ Submission Queue error:", err.message);
});

/**
 * Enqueue a code submission for async processing by the worker.
 *
 * @param {Object} data - The submission payload
 * @param {string} data.submissionId - DB submission row ID
 * @param {string} data.code - Source code
 * @param {string} data.language - Language identifier (e.g., "javascript", "python", "cpp")
 * @param {string} data.problemId - Problem ID to fetch test cases
 * @param {string} data.userId - Submitting user's ID
 * @returns {Promise<import("bullmq").Job>}
 */
export const enqueueSubmission = async (data) => {
  const job = await submissionQueue.add("process-submission", data, {
    jobId: data.submissionId, // prevents duplicate jobs for the same submission
  });
  console.log(`📥 Enqueued submission ${data.submissionId} as job ${job.id}`);
  return job;
};

export default submissionQueue;
