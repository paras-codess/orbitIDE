import { Router } from "express";
import {
  createContest,
  joinContest,
  startContest,
  getContestDetails,
  getContestLeaderboard,
  getContests,
} from "../controllers/contestController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// All contest routes are authenticated
router.use(authenticate);

router.get("/", getContests);
router.post("/", createContest);
router.post("/join", joinContest);
router.post("/:id/start", startContest);
router.get("/:id", getContestDetails);
router.get("/:id/leaderboard", getContestLeaderboard);

export default router;
