import { Router } from "express";
import { register, login, getMe, updateProfile, verifyEmail, googleLogin, setGoogleUsername } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public routes (no token needed)
router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/google", googleLogin);

// Protected routes (token required)
router.get("/me", authenticate, getMe);
router.put("/profile", authenticate, updateProfile);
router.post("/google/set-username", authenticate, setGoogleUsername);

export default router;
