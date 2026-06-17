import { Router } from "express";
import { visualizeCode } from "../controllers/visualizerController.js";

const router = Router();

// Public route — no authentication required
router.post("/", visualizeCode);

export default router;
