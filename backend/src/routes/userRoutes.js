import { Router } from "express";
import { getUserStats } from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Protected endpoint to retrieve Day 5 analytics
router.get("/stats", authenticate, getUserStats);

export default router;
