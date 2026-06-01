import { Worker } from "bullmq";
import prisma from "../config/db.js";
import dotenv from "dotenv";
import { emitSubmissionVerdict } from "../config/socket.js";

dotenv.config();

// ------------------------------------
// Judge0 API Configuration
// ------------------------------------
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";

// ------------------------------------
// Language → Judge0 language_id mapping
// See: https://ce.judge0.com/languages
// ------------------------------------
const LANGUAGE_MAP = {
  c: 50,          // C (GCC 9.2.0)
  cpp: 54,        // C++ (GCC 9.2.0)
  java: 62,       // Java (OpenJDK 13.0.1)
  python: 71,     // Python (3.8.1)
  javascript: 63, // JavaScript (Node.js 12.14.0)
};

// ------------------------------------
// Judge0 Verdict Status IDs
// ------------------------------------
const JUDGE0_STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
};

/**
 * Map Judge0 status_id to Prisma Verdict enum.
 */
const mapJudge0Verdict = (statusId) => {
  if (statusId === JUDGE0_STATUS.ACCEPTED) return "ACCEPTED";
  if (statusId === JUDGE0_STATUS.WRONG_ANSWER) return "WRONG_ANSWER";
  if (statusId === JUDGE0_STATUS.TIME_LIMIT_EXCEEDED) return "TIME_LIMIT_EXCEEDED";
  if (statusId === JUDGE0_STATUS.COMPILATION_ERROR) return "COMPILATION_ERROR";
  if (statusId >= 7 && statusId <= 12) return "RUNTIME_ERROR";
  // Default to RUNTIME_ERROR for anything unexpected
  return "RUNTIME_ERROR";
};

// ------------------------------------
// Parse REDIS_URL for BullMQ IORedis options
// ------------------------------------
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const parsedUrl = new URL(redisUrl);

const connection = {
  host: parsedUrl.hostname,
  port: parseInt(parsedUrl.port, 10) || 6379,
  password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
  username: parsedUrl.username || undefined,
  tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
  maxRetriesPerRequest: null, // Required by BullMQ workers
};

// ------------------------------------
// Submit code to Judge0 and wait for result
// ------------------------------------
const submitToJudge0 = async (code, languageId, stdin, expectedOutput) => {
  const headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Host": new URL(JUDGE0_API_URL).hostname,
    "X-RapidAPI-Key": JUDGE0_API_KEY,
  };

  // Create a submission (synchronous mode — wait=true)
  const createResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: code,
      language_id: languageId,
      stdin: stdin || "",
      expected_output: expectedOutput || "",
      cpu_time_limit: 5,    // 5 seconds
      memory_limit: 256000, // 256 MB
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Judge0 API error (${createResponse.status}): ${errorText}`);
  }

  return createResponse.json();
};

// ------------------------------------
// Worker Processor — Runs per job
// ------------------------------------
const processSubmission = async (job) => {
  const { submissionId, code, language, problemId, userId } = job.data;

  console.log(`⚙️  Processing submission ${submissionId} [${language}]`);

  try {
    // 1. Get language ID
    const languageId = LANGUAGE_MAP[language.toLowerCase()];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // 2. Fetch all test cases for the problem
    const testCases = await prisma.testCase.findMany({
      where: { problemId },
      orderBy: { id: "asc" },
    });

    if (testCases.length === 0) {
      throw new Error(`No test cases found for problem ${problemId}`);
    }

    // 3. Run code against each test case
    let finalVerdict = "ACCEPTED";
    let maxExecutionTime = 0;
    let maxMemoryUsage = 0;

    for (const testCase of testCases) {
      const result = await submitToJudge0(code, languageId, testCase.input, testCase.output);

      // Track resource usage
      const time = result.time ? Math.round(parseFloat(result.time) * 1000) : 0; // convert to ms
      const memory = result.memory || 0; // KB
      maxExecutionTime = Math.max(maxExecutionTime, time);
      maxMemoryUsage = Math.max(maxMemoryUsage, memory);

      // If any test case fails, set verdict and stop
      if (result.status.id !== JUDGE0_STATUS.ACCEPTED) {
        finalVerdict = mapJudge0Verdict(result.status.id);
        console.log(`❌ Test case failed: ${result.status.description}`);
        break;
      }
    }

    // 4. Update the Submission record in DB
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: finalVerdict,
        executionTime: maxExecutionTime,
        memoryUsage: maxMemoryUsage,
      },
    });

    console.log(`✅ Submission ${submissionId} → ${finalVerdict} (${maxExecutionTime}ms, ${maxMemoryUsage}KB)`);

    // Emit live WebSocket verdict notification to user
    emitSubmissionVerdict(userId, {
      submissionId,
      verdict: finalVerdict,
      executionTime: maxExecutionTime,
      memoryUsage: maxMemoryUsage,
    });

    // 5. Update UserTopicStat if the problem has a topic
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { topic: true },
    });

    if (problem?.topic) {
      await updateUserTopicStat(userId, problem.topic, finalVerdict);
    }

    return { verdict: finalVerdict, executionTime: maxExecutionTime, memoryUsage: maxMemoryUsage };
  } catch (error) {
    console.error(`💥 Submission ${submissionId} processing failed:`, error.message);

    // Mark as RUNTIME_ERROR on unexpected failure
    await prisma.submission.update({
      where: { id: submissionId },
      data: { verdict: "RUNTIME_ERROR" },
    });

    throw error; // BullMQ will retry based on job options
  }
};

// ------------------------------------
// Update UserTopicStat Table
// ------------------------------------
const updateUserTopicStat = async (userId, topic, verdict) => {
  const isAccepted = verdict === "ACCEPTED";

  // Upsert: create if not exists, update if exists
  const existing = await prisma.userTopicStat.findUnique({
    where: {
      userId_topic: { userId, topic },
    },
  });

  if (existing) {
    const newSolved = existing.solved + (isAccepted ? 1 : 0);
    const newFailed = existing.failed + (isAccepted ? 0 : 1);
    const total = newSolved + newFailed;
    const newAccuracy = total > 0 ? (newSolved / total) * 100 : 0;
    // Confidence grows with more attempts, weighted by accuracy
    const newConfidence = Math.min(100, (newAccuracy * Math.log2(total + 1)) / 5);

    await prisma.userTopicStat.update({
      where: { userId_topic: { userId, topic } },
      data: {
        solved: newSolved,
        failed: newFailed,
        accuracy: parseFloat(newAccuracy.toFixed(2)),
        confidenceScore: parseFloat(newConfidence.toFixed(2)),
      },
    });
  } else {
    await prisma.userTopicStat.create({
      data: {
        userId,
        topic,
        solved: isAccepted ? 1 : 0,
        failed: isAccepted ? 0 : 1,
        accuracy: isAccepted ? 100 : 0,
        confidenceScore: isAccepted ? 13.86 : 0, // log2(2)/5 * 100
      },
    });
  }
};

// ------------------------------------
// Start Worker
// ------------------------------------
export const startSubmissionWorker = () => {
  const worker = new Worker("submission-queue", processSubmission, {
    connection,
    concurrency: 3, // process up to 3 submissions in parallel
    limiter: {
      max: 10,
      duration: 60000, // max 10 jobs per minute (respects Judge0 rate limits)
    },
  });

  worker.on("completed", (job, result) => {
    console.log(`🎉 Job ${job.id} completed: ${result.verdict}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`💀 Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("❌ Submission Worker error:", err.message);
  });

  console.log("🚀 Submission Worker started (concurrency: 3)");
  return worker;
};
