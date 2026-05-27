import { Router } from "express";
import { register, login, getMe, updateProfile, verifyEmail } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public routes (no token needed)
router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);

// Protected routes (token required)
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, updateProfile);

export default router;
