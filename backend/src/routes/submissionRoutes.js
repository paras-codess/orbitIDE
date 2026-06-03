import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { submissionLimiter } from "../middleware/rateLimiter.js";
import {
  runCode,
  submitCode,
  getSubmissionStatus,
  getMySubmissions,
} from "../controllers/submissionController.js";

const router = Router();

// All submission routes require authentication
router.use(authenticate);

// POST /api/submissions/run — Run code against sample tests (synchronous, rate limited: 5/min)
router.post("/run", submissionLimiter, runCode);

// POST /api/submissions/submit — Submit code (rate limited: 5/min)
router.post("/submit", submissionLimiter, submitCode);

// GET /api/submissions/my — Get current user's submissions (paginated)
router.get("/my", getMySubmissions);

// GET /api/submissions/:id/status — Poll submission verdict
router.get("/:id/status", getSubmissionStatus);

export default router;
