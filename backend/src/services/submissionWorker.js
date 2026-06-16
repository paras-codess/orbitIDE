import { Worker } from "bullmq";
import prisma from "../config/db.js";
import dotenv from "dotenv";
import { emitSubmissionVerdict } from "../config/socket.js";
import redis from "../config/redis.js";

dotenv.config();

// ------------------------------------
// Wandbox API Configuration (FREE — No API key needed!)
// https://wandbox.org
// ------------------------------------
const WANDBOX_API_URL = process.env.WANDBOX_API_URL || "https://wandbox.org/api";

// ------------------------------------
// Language → Wandbox compiler mapping
// ------------------------------------
const COMPILER_MAP = {
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
  java: "openjdk-jdk-21+35",
  python: "cpython-3.13.8",
  javascript: "nodejs-20.17.0",
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
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    if (times > 5) {
      return null; // Stop retrying
    }
    return delay;
  },
};

// ------------------------------------
// Execute code on Wandbox API
// Returns { stdout, stderr, exitCode, isCompileError, compileError }
// ------------------------------------
export const executeOnWandbox = async (code, language, stdin) => {
  const compiler = COMPILER_MAP[language.toLowerCase()];
  if (!compiler) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const response = await fetch(`${WANDBOX_API_URL}/compile.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      compiler,
      stdin: stdin || "",
      "runtime-option-raw": "",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wandbox API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  // Check for compilation errors
  if (result.compiler_error && result.compiler_error.trim() !== "") {
    return {
      stdout: "",
      stderr: result.compiler_error,
      exitCode: parseInt(result.status, 10) || 1,
      isCompileError: true,
    };
  }

  // Check for runtime signal (SIGKILL = TLE, SIGSEGV = segfault, etc.)
  const signal = result.signal || "";
  const status = parseInt(result.status, 10) || 0;

  return {
    stdout: result.program_output || "",
    stderr: result.program_error || "",
    exitCode: status,
    signal,
    isCompileError: false,
  };
};

// ------------------------------------
// Worker Processor — Runs per job
// ------------------------------------
export const processSubmission = async (job) => {
  const { submissionId, code, language, problemId, userId } = job.data;

  console.log(`⚙️  Processing submission ${submissionId} [${language}]`);

  try {
    // 1. Validate language
    if (!COMPILER_MAP[language.toLowerCase()]) {
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
    let failedTestIndex = null; // 1-based index of first failure
    const testResults = [];

    console.log(`📋 Running ${testCases.length} test cases on Wandbox...`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const startTime = Date.now();

      const result = await executeOnWandbox(code, language, testCase.input);

      const executionTime = Date.now() - startTime;
      maxExecutionTime = Math.max(maxExecutionTime, executionTime);

      // Build per-test result object (respecting isHidden flag)
      const testResult = {
        testNumber: i + 1,
        passed: false,
        verdict: "PASSED",
        executionTime,
        isHidden: testCase.isHidden,
      };

      // Check for compilation error
      if (result.isCompileError) {
        finalVerdict = "COMPILATION_ERROR";
        failedTestIndex = i + 1;
        testResult.verdict = "COMPILATION_ERROR";
        testResult.errorMessage = result.stderr ? result.stderr.substring(0, 500) : undefined;
        testResults.push(testResult);
        console.log(`❌ Compilation Error: ${result.stderr.substring(0, 200)}`);
        break;
      }

      // Check for signal-based errors (TLE, segfault)
      if (result.signal) {
        if (result.signal === "SIGKILL" || result.signal === "SIGXCPU") {
          finalVerdict = "TIME_LIMIT_EXCEEDED";
          testResult.verdict = "TIME_LIMIT_EXCEEDED";
        } else {
          finalVerdict = "RUNTIME_ERROR";
          testResult.verdict = "RUNTIME_ERROR";
        }
        failedTestIndex = i + 1;
        testResult.errorMessage = result.stderr ? result.stderr.substring(0, 500) : undefined;
        testResults.push(testResult);
        console.log(`❌ Test ${i + 1}: ${finalVerdict} (signal: ${result.signal})`);
        break;
      }

      // Check for runtime error (non-zero exit code)
      if (result.exitCode !== 0) {
        finalVerdict = "RUNTIME_ERROR";
        failedTestIndex = i + 1;
        testResult.verdict = "RUNTIME_ERROR";
        testResult.errorMessage = result.stderr ? result.stderr.substring(0, 500) : undefined;
        testResults.push(testResult);
        console.log(`❌ Test ${i + 1}: Runtime Error (exit code: ${result.exitCode})`);
        break;
      }

      // Compare output (trim trailing whitespace/newlines)
      const actualOutput = result.stdout.trim();
      const expectedOutput = (testCase.output || "").trim();

      if (actualOutput !== expectedOutput) {
        finalVerdict = "WRONG_ANSWER";
        failedTestIndex = i + 1;
        testResult.verdict = "WRONG_ANSWER";
        // Only expose input/output for non-hidden test cases
        if (!testCase.isHidden) {
          testResult.input = testCase.input;
          testResult.expectedOutput = expectedOutput;
          testResult.actualOutput = actualOutput;
        }
        testResults.push(testResult);
        console.log(`❌ Test ${i + 1}: Wrong Answer (expected "${expectedOutput.substring(0, 50)}", got "${actualOutput.substring(0, 50)}")`);
        break;
      }

      // Test passed
      testResult.passed = true;
      testResults.push(testResult);
      console.log(`  ✓ Test ${i + 1}/${testCases.length} passed (${executionTime}ms)`);
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

    console.log(`✅ Submission ${submissionId} → ${finalVerdict} (${maxExecutionTime}ms)`);

    // 5. Emit live WebSocket verdict notification to user
    emitSubmissionVerdict(userId, {
      submissionId,
      verdict: finalVerdict,
      executionTime: maxExecutionTime,
      memoryUsage: maxMemoryUsage,
      failedTestCase: failedTestIndex,
      totalTests: testCases.length,
      testResults,
    });

    // 6. Update UserTopicStat if the problem has a topic
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { topic: true },
    });

    if (problem?.topic) {
      await updateUserTopicStat(userId, problem.topic, finalVerdict);
    }

    // Invalidate user stats cache in Redis
    if (redis.status === "ready") {
      try {
        const cacheKey = `rl:orbitide:stats:${userId}`;
        await redis.del(cacheKey);
        console.log(`🧹 Invalidated stats cache for user: ${userId}`);
      } catch (err) {
        console.error("⚠️ Failed to invalidate user stats cache in Redis:", err.message);
      }
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
      duration: 60000, // max 10 jobs per minute
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

  console.log("🚀 Submission Worker started (engine: Wandbox API, concurrency: 3)");
  return worker;
};
