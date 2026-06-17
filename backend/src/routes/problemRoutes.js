import { Router } from "express";
import {
  getProblems,
  getTopics,
  getProblemById,
  createProblem,
  updateProblem,
  deleteProblem,
} from "../controllers/problemController.js";
import { authenticate, authorizeAdmin, optionalAuthenticate } from "../middleware/auth.js";

const router = Router();

// Public routes
router.get("/", optionalAuthenticate, getProblems);
router.get("/topics", getTopics);
router.get("/:id", getProblemById);

// Admin-only protected routes
router.post("/", authenticate, authorizeAdmin, createProblem);
router.put("/:id", authenticate, authorizeAdmin, updateProblem);
router.delete("/:id", authenticate, authorizeAdmin, deleteProblem);

export default router;
