import prisma from "../config/db.js";
import { enqueueSubmission } from "../services/submissionQueue.js";
import { executeCode, processSubmission } from "../services/submissionWorker.js";
import redis from "../config/redis.js";

// ------------------------------------
// POST /api/submissions/run
// Runs code against sample (non-hidden) test cases synchronously.
// No DB row created — used for the "Run Code" button.
// ------------------------------------
export const runCode = async (req, res) => {
  try {
    const { problemId, language, code, customTestCases } = req.body;

    // ---- Validation ----
    if (!problemId || !language || !code) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: problemId, language, code.",
      });
    }

    const supportedLanguages = ["c", "cpp", "java", "python", "javascript"];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported language: ${language}. Supported: ${supportedLanguages.join(", ")}`,
      });
    }

    // ---- Determine test cases to run ----
    let testCasesToRun = [];

    if (customTestCases && customTestCases.length > 0) {
      // Use custom test cases provided by the user
      testCasesToRun = customTestCases.map((tc, i) => ({
        input: tc.input || "",
        output: tc.expectedOutput || "",
        isCustom: tc.isCustom || false,
        index: i,
      }));
    } else {
      // Fetch only sample (non-hidden) test cases from DB
      const sampleCases = await prisma.testCase.findMany({
        where: { problemId, isHidden: false },
        orderBy: { id: "asc" },
        select: { input: true, output: true },
      });

      if (sampleCases.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "No sample test cases found for this problem.",
        });
      }

      testCasesToRun = sampleCases.map((tc, i) => ({
        input: tc.input,
        output: tc.output,
        isCustom: false,
        index: i,
      }));
    }

    // ---- Execute code against each test case ----
    const results = [];
    let overallVerdict = "ACCEPTED";
    let maxTime = 0;

    for (let i = 0; i < testCasesToRun.length; i++) {
      const tc = testCasesToRun[i];
      const startTime = Date.now();

      try {
        const result = await executeCode(code, language.toLowerCase(), tc.input);
        const executionTime = Date.now() - startTime;
        maxTime = Math.max(maxTime, executionTime);

        const actualOutput = (result.stdout || "").trim();
        const expectedOutput = (tc.output || "").trim();

        let verdict = "PASSED";
        let passed = true;

        if (result.isCompileError) {
          verdict = "COMPILATION_ERROR";
          passed = false;
          overallVerdict = "COMPILATION_ERROR";
        } else if (result.signal) {
          verdict = (result.signal === "SIGKILL" || result.signal === "SIGXCPU")
            ? "TIME_LIMIT_EXCEEDED"
            : "RUNTIME_ERROR";
          passed = false;
          if (overallVerdict === "ACCEPTED") overallVerdict = verdict;
        } else if (result.exitCode !== 0) {
          verdict = "RUNTIME_ERROR";
          passed = false;
          if (overallVerdict === "ACCEPTED") overallVerdict = verdict;
        } else if (expectedOutput && actualOutput !== expectedOutput) {
          verdict = "WRONG_ANSWER";
          passed = false;
          if (overallVerdict === "ACCEPTED") overallVerdict = verdict;
        }

        results.push({
          testNumber: i + 1,
          passed,
          verdict,
          executionTime,
          input: tc.input,
          expectedOutput: tc.output || "",
          actualOutput,
          stderr: result.stderr || "",
          isCustom: tc.isCustom,
        });
      } catch (execError) {
        const executionTime = Date.now() - startTime;
        results.push({
          testNumber: i + 1,
          passed: false,
          verdict: "RUNTIME_ERROR",
          executionTime,
          input: tc.input,
          expectedOutput: tc.output || "",
          actualOutput: "",
          stderr: execError.message,
          isCustom: tc.isCustom,
        });
        if (overallVerdict === "ACCEPTED") overallVerdict = "RUNTIME_ERROR";
      }
    }

    return res.json({
      status: "success",
      data: {
        verdict: overallVerdict,
        executionTime: maxTime,
        totalTests: testCasesToRun.length,
        testResults: results,
      },
    });
  } catch (error) {
    console.error("Run code error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to run code.",
    });
  }
};

// ------------------------------------
// POST /api/submissions/submit
// Enqueues a code submission for async processing.
// Returns 202 Accepted with tracking ID immediately.
// ------------------------------------
export const submitCode = async (req, res) => {
  try {
    const { problemId, language, code, contestId } = req.body;
    const userId = req.user.id;

    // ---- Validation ----
    if (!problemId || !language || !code) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: problemId, language, code.",
      });
    }

    const supportedLanguages = ["c", "cpp", "java", "python", "javascript"];
    if (!supportedLanguages.includes(language.toLowerCase())) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported language: ${language}. Supported: ${supportedLanguages.join(", ")}`,
      });
    }

    // ---- Verify problem exists ----
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, title: true },
    });

    if (!problem) {
      return res.status(404).json({
        status: "error",
        message: "Problem not found.",
      });
    }

    // ---- Verify contest active state if contestId is provided ----
    let validatedContestId = null;
    if (contestId) {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
      });
      if (!contest) {
        return res.status(404).json({
          status: "error",
          message: "Contest not found.",
        });
      }

      // Check if user is a participant
      const participant = await prisma.contestParticipant.findUnique({
        where: {
          contestId_userId: {
            contestId,
            userId,
          },
        },
      });

      if (!participant) {
        return res.status(403).json({
          status: "error",
          message: "You are not registered in this contest.",
        });
      }

      // Check if the contest has started for this participant
      const contestStartTime = contest.type === "ROOM" ? contest.startTime : participant.startedAt;
      if (!contestStartTime) {
        return res.status(400).json({
          status: "error",
          message: "The contest has not started yet.",
        });
      }

      // Check if the timer has expired
      const durationMs = contest.duration * 60 * 1000;
      const elapsedMs = Date.now() - new Date(contestStartTime).getTime();
      if (elapsedMs > durationMs) {
        return res.status(400).json({
          status: "error",
          message: "Contest timer has expired. Submissions are closed.",
        });
      }

      validatedContestId = contestId;
    }

    // ---- Create submission row (PENDING) ----
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        contestId: validatedContestId,
        language: language.toLowerCase(),
        code,
        verdict: "PENDING",
      },
    });

    // ---- Enqueue for async processing ----
    let enqueuedSuccessfully = false;
    if (redis.status === "ready") {
      try {
        await enqueueSubmission({
          submissionId: submission.id,
          code,
          language: language.toLowerCase(),
          problemId,
          userId,
        });
        enqueuedSuccessfully = true;
      } catch (queueError) {
        console.warn(`⚠️ Failed to enqueue submission ${submission.id}: ${queueError.message}`);
      }
    }

    if (!enqueuedSuccessfully) {
      // Offline fallback: Process in background using setImmediate
      setImmediate(async () => {
        try {
          console.log(`⚠️ Redis is offline or queue failed. Processing submission ${submission.id} via in-memory fallback.`);
          await processSubmission({
            data: {
              submissionId: submission.id,
              code,
              language: language.toLowerCase(),
              problemId,
              userId,
            },
          });
        } catch (fallbackError) {
          console.error(`💥 Fallback processing failed for submission ${submission.id}:`, fallbackError.message);
        }
      });
    }

    // ---- Return 202 Accepted ----
    return res.status(202).json({
      status: "pending",
      message: enqueuedSuccessfully 
        ? "Submission received and queued for processing."
        : "Submission received and processing in fallback mode.",
      data: {
        submissionId: submission.id,
        verdict: "PENDING",
      },
    });
  } catch (error) {
    console.error("Submit code error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to submit code.",
    });
  }
};

// ------------------------------------
// GET /api/submissions/:id/status
// Poll the current verdict/status of a submission.
// ------------------------------------
export const getSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        problemId: true,
        language: true,
        verdict: true,
        executionTime: true,
        memoryUsage: true,
        createdAt: true,
      },
    });

    if (!submission) {
      return res.status(404).json({
        status: "error",
        message: "Submission not found.",
      });
    }

    // Only the submitting user (or admin) can view submission status
    if (submission.userId !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "Access denied.",
      });
    }

    return res.json({
      status: "success",
      data: submission,
    });
  } catch (error) {
    console.error("Get submission status error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to get submission status.",
    });
  }
};

// ------------------------------------
// GET /api/submissions/my
// Get all submissions for the authenticated user.
// ------------------------------------
export const getMySubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { problemId, page = 1, limit = 20 } = req.query;

    const where = { userId };
    if (problemId) {
      where.problemId = problemId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        select: {
          id: true,
          problemId: true,
          language: true,
          code: true,
          verdict: true,
          executionTime: true,
          memoryUsage: true,
          createdAt: true,
          problem: {
            select: { title: true, difficulty: true, topic: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.submission.count({ where }),
    ]);

    return res.json({
      status: "success",
      data: {
        submissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get my submissions error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch submissions.",
    });
  }
};
