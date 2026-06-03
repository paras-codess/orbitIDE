import prisma from "../config/db.js";
import { enqueueSubmission } from "../services/submissionQueue.js";
import { executeOnWandbox } from "../services/submissionWorker.js";

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
        const result = await executeOnWandbox(code, language.toLowerCase(), tc.input);
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
    const { problemId, language, code } = req.body;
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

    // ---- Create submission row (PENDING) ----
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        language: language.toLowerCase(),
        code,
        verdict: "PENDING",
      },
    });

    // ---- Enqueue for async processing ----
    await enqueueSubmission({
      submissionId: submission.id,
      code,
      language: language.toLowerCase(),
      problemId,
      userId,
    });

    // ---- Return 202 Accepted ----
    return res.status(202).json({
      status: "pending",
      message: "Submission received and queued for processing.",
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
