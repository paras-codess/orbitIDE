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
// Piston API Configuration (FREE fallback — No API key needed!)
// https://emkc.org
// ------------------------------------
const PISTON_API_URL = process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston/execute";

const PISTON_MAP = {
  c:          { language: "c",          version: "10.2.0"  },
  cpp:        { language: "c++",        version: "10.2.0"  },
  java:       { language: "java",       version: "15.0.2"  },
  python:     { language: "python",     version: "3.10.0"  },
  javascript: { language: "javascript", version: "18.15.0" },
};

// Timeout threshold before falling back to Piston (ms)
const WANDBOX_TIMEOUT_MS = 10000;

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
export const executeOnWandbox = async (code, language, stdin, signal) => {
  const compiler = COMPILER_MAP[language.toLowerCase()];
  if (!compiler) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const response = await fetch(`${WANDBOX_API_URL}/compile.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
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
  const signal_ = result.signal || "";
  const status = parseInt(result.status, 10) || 0;

  return {
    stdout: result.program_output || "",
    stderr: result.program_error || "",
    exitCode: status,
    signal: signal_,
    isCompileError: false,
  };
};

// ------------------------------------
// Execute code on Piston API (Fallback)
// Returns same format as executeOnWandbox
// ------------------------------------
export const executeOnPiston = async (code, language, stdin) => {
  const config = PISTON_MAP[language.toLowerCase()];
  if (!config) {
    throw new Error(`Piston: Unsupported language: ${language}`);
  }

  const response = await fetch(PISTON_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: config.language,
      version: config.version,
      files: [{ content: code }],
      stdin: stdin || "",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Piston API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const run = result.run || {};
  const compile = result.compile || {};

  // Check for compilation errors
  if (compile.code !== undefined && compile.code !== 0) {
    return {
      stdout: "",
      stderr: compile.stderr || compile.output || "",
      exitCode: compile.code,
      signal: "",
      isCompileError: true,
    };
  }

  return {
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    exitCode: run.code || 0,
    signal: run.signal || "",
    isCompileError: false,
  };
};

// ------------------------------------
// Smart Execution — Wandbox first, Piston fallback
// Tries Wandbox with a timeout, falls back to Piston on failure
// Also detects Wandbox infrastructure errors (OCI/container) in the response
// ------------------------------------

// Known Wandbox infrastructure error patterns (not user code errors)
const INFRA_ERROR_PATTERNS = [
  "OCI runtime error",
  "crun:",
  "container",
  "Resource temporarily unavailable",
  "runc:",
  "podman",
];

const isInfrastructureError = (result) => {
  const stderr = (result.stderr || "").toLowerCase();
  return INFRA_ERROR_PATTERNS.some((pattern) => stderr.includes(pattern.toLowerCase()));
};

export const executeCode = async (code, language, stdin) => {
  // Try Wandbox first with timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WANDBOX_TIMEOUT_MS);

    const result = await executeOnWandbox(code, language, stdin, controller.signal);
    clearTimeout(timeout);

    // Check if Wandbox returned an infrastructure error (not a user code error)
    if (isInfrastructureError(result)) {
      console.warn(`⚠️ Wandbox returned infrastructure error: "${result.stderr.substring(0, 100)}". Falling back to Piston...`);
    } else {
      return result;
    }
  } catch (wandboxError) {
    console.warn(`⚠️ Wandbox failed (${wandboxError.message}), falling back to Piston...`);
  }

  // Fallback to Piston
  return await executeOnPiston(code, language, stdin);
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

      const result = await executeCode(code, language, testCase.input);

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
      await updateUserTopicStat(userId, problem.topic);
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
export const updateUserTopicStat = async (userId, topic) => {
  const difficultyWeights = { EASY: 1, MEDIUM: 2, HARD: 3 };

  // 1. Fetch unique solved problems on this topic for this user
  const solvedProblems = await prisma.submission.findMany({
    where: {
      userId,
      verdict: "ACCEPTED",
      problem: { topic },
    },
    select: {
      problem: {
        select: { difficulty: true },
      },
    },
    distinct: ["problemId"],
  });

  // 2. Fetch all unique attempted problems on this topic for this user
  const attemptedProblems = await prisma.submission.findMany({
    where: {
      userId,
      problem: { topic },
    },
    select: {
      problemId: true,
    },
    distinct: ["problemId"],
  });

  const solvedCount = solvedProblems.length;
  const attemptedCount = attemptedProblems.length;
  const failedCount = Math.max(0, attemptedCount - solvedCount);

  // 3. Sum up the difficulty weights of solved problems
  const solvedWeight = solvedProblems.reduce((acc, curr) => {
    return acc + (difficultyWeights[curr.problem.difficulty] || 1);
  }, 0);

  // 4. Calculate stats using consistent formulas
  const accuracy = attemptedCount > 0 ? (solvedCount / attemptedCount) * 100 : 0;
  const confidence = Math.min(100, (accuracy * Math.log2(solvedWeight + 1)) / 5);

  const finalAccuracy = parseFloat(accuracy.toFixed(2));
  const finalConfidence = parseFloat(confidence.toFixed(2));

  // 5. Upsert statistics in UserTopicStat table
  await prisma.userTopicStat.upsert({
    where: {
      userId_topic: { userId, topic },
    },
    update: {
      solved: solvedCount,
      failed: failedCount,
      accuracy: finalAccuracy,
      confidenceScore: finalConfidence,
    },
    create: {
      userId,
      topic,
      solved: solvedCount,
      failed: failedCount,
      accuracy: finalAccuracy,
      confidenceScore: finalConfidence,
    },
  });
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
