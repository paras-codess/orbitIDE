import prisma from "../config/db.js";
import { enqueueSubmission } from "../services/submissionQueue.js";

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
