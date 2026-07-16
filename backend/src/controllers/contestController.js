import prisma from "../config/db.js";
import { emitContestStart } from "../config/socket.js";

/**
 * Helper to generate a unique 6-character uppercase alphanumeric room code
 */
const generateRoomCode = async () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let isUnique = false;

  while (!isUnique) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check uniqueness in database
    const existing = await prisma.contest.findUnique({
      where: { code },
    });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

/**
 * POST /api/contests
 * Creates a new custom contest (SOLO or ROOM)
 */
export const createContest = async (req, res) => {
  try {
    const { title, description, duration, type, problemIds } = req.body;
    const userId = req.user.id;

    // 1. Validation
    if (!title || !duration || !type || !problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: title, duration, type, and at least one problem.",
      });
    }

    if (!["SOLO", "ROOM"].includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid contest type. Supported types: SOLO, ROOM.",
      });
    }

    const durationInt = parseInt(duration, 10);
    if (isNaN(durationInt) || durationInt <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Duration must be a positive integer.",
      });
    }

    // 2. Generate room code if type is ROOM
    let code = null;
    if (type === "ROOM") {
      code = await generateRoomCode();
    }

    // 3. Create contest and contest problems in transaction
    const contest = await prisma.$transaction(async (tx) => {
      // Create contest
      const newContest = await tx.contest.create({
        data: {
          title,
          description,
          duration: durationInt,
          type,
          code,
          createdBy: userId,
        },
      });

      // Map and create contest problems
      const contestProblemsData = problemIds.map((probId, idx) => ({
        contestId: newContest.id,
        problemId: probId,
        order: idx,
        points: 100, // Default 100 points per problem
      }));

      await tx.contestProblem.createMany({
        data: contestProblemsData,
      });

      // If SOLO, automatically join the creator and start immediately
      if (type === "SOLO") {
        await tx.contestParticipant.create({
          data: {
            contestId: newContest.id,
            userId,
            startedAt: new Date(),
          },
        });
      } else {
        // Creators join the room as participant but don't start it yet
        await tx.contestParticipant.create({
          data: {
            contestId: newContest.id,
            userId,
          },
        });
      }

      return newContest;
    });

    res.status(201).json({
      status: "success",
      message: "Contest created successfully.",
      data: contest,
    });
  } catch (error) {
    console.error("❌ Create contest error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create contest.",
    });
  }
};

/**
 * POST /api/contests/join
 * Joins a ROOM contest using a room code
 */
export const joinContest = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "Room code is required to join a contest.",
      });
    }

    // Find contest by code
    const contest = await prisma.contest.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!contest) {
      return res.status(404).json({
        status: "error",
        message: "Contest room not found with this code.",
      });
    }

    if (contest.type !== "ROOM") {
      return res.status(400).json({
        status: "error",
        message: "Only room-type contests can be joined via code.",
      });
    }

    // Check if contest has already started/ended
    if (contest.startTime) {
      const elapsedMs = Date.now() - new Date(contest.startTime).getTime();
      const durationMs = contest.duration * 60 * 1000;
      if (elapsedMs > durationMs) {
        return res.status(400).json({
          status: "error",
          message: "This contest has already ended.",
        });
      }
    }

    // Register user as participant (upsert/findOrCreate style to avoid duplicates)
    const participant = await prisma.contestParticipant.upsert({
      where: {
        contestId_userId: {
          contestId: contest.id,
          userId,
        },
      },
      update: {}, // No updates if already joined
      create: {
        contestId: contest.id,
        userId,
        // If the room contest is already running, set their start time to when the room started
        startedAt: contest.startTime ? contest.startTime : null,
      },
    });

    res.json({
      status: "success",
      message: "Joined contest room successfully.",
      data: {
        contest,
        participant,
      },
    });
  } catch (error) {
    console.error("❌ Join contest error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to join contest.",
    });
  }
};

/**
 * POST /api/contests/:id/start
 * Starts the contest timer (for creator in ROOM, or self in SOLO)
 */
export const startContest = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user.id;

    // Find contest
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      return res.status(404).json({
        status: "error",
        message: "Contest not found.",
      });
    }

    if (contest.type === "SOLO") {
      // For SOLO, set start time for this participant
      const participant = await prisma.contestParticipant.update({
        where: {
          contestId_userId: {
            contestId,
            userId,
          },
        },
        data: {
          startedAt: new Date(),
        },
      });

      return res.json({
        status: "success",
        message: "Contest timer started.",
        data: participant,
      });
    } else if (contest.type === "ROOM") {
      // For ROOM, only the creator can trigger the start
      if (contest.createdBy !== userId) {
        return res.status(403).json({
          status: "error",
          message: "Only the creator can start a room contest.",
        });
      }

      if (contest.startTime) {
        return res.status(400).json({
          status: "error",
          message: "Contest has already started.",
        });
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + contest.duration * 60 * 1000);

      // Update contest and start all current participants
      await prisma.$transaction(async (tx) => {
        await tx.contest.update({
          where: { id: contestId },
          data: {
            startTime,
            endTime,
          },
        });

        await tx.contestParticipant.updateMany({
          where: { contestId },
          data: {
            startedAt: startTime,
          },
        });
      });

      // Broadcast contest start event to all room sockets
      emitContestStart(contestId, startTime.toISOString());

      return res.json({
        status: "success",
        message: "Contest started successfully for all participants.",
        data: { startTime, endTime },
      });
    }
  } catch (error) {
    console.error("❌ Start contest error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to start contest.",
    });
  }
};

/**
 * GET /api/contests/:id
 * Fetches contest details (and filters problem statements based on start state)
 */
export const getContestDetails = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user.id;

    // Fetch contest with problems and participants
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        problems: {
          include: {
            problem: {
              select: {
                id: true,
                title: true,
                difficulty: true,
                topic: true,
                description: true,
                constraints: true,
                inputFormat: true,
                outputFormat: true,
                sampleInput: true,
                sampleOutput: true,
                testCases: {
                  where: { isHidden: false },
                  select: {
                    id: true,
                    input: true,
                    output: true,
                  },
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
        participants: {
          select: {
            userId: true,
            score: true,
            penalty: true,
            startedAt: true,
            finishedAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({
        status: "error",
        message: "Contest not found.",
      });
    }

    // Check if user is a participant
    const userPart = contest.participants.find((p) => p.userId === userId);
    if (!userPart) {
      return res.status(403).json({
        status: "error",
        message: "You are not registered in this contest.",
      });
    }

    // Anti-Cheating: Hide full problems if user timer has not started
    const hasStarted = contest.type === "ROOM" ? !!contest.startTime : !!userPart.startedAt;
    
    let processedProblems = [];
    if (hasStarted) {
      processedProblems = contest.problems.map((cp) => cp.problem);
    } else {
      // Return redacted problem list (ids & titles only)
      processedProblems = contest.problems.map((cp) => ({
        id: cp.problem.id,
        title: cp.problem.title,
        difficulty: cp.problem.difficulty,
        topic: cp.problem.topic,
        isRedacted: true, // Marker to indicate statements are hidden
      }));
    }

    // Return the response payload
    res.json({
      status: "success",
      data: {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        type: contest.type,
        code: contest.code,
        duration: contest.duration,
        startTime: contest.startTime,
        endTime: contest.endTime,
        createdBy: contest.createdBy,
        problems: processedProblems,
        participants: contest.participants,
        userParticipantState: userPart,
      },
    });
  } catch (error) {
    console.error("❌ Get contest details error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to load contest details.",
    });
  }
};

/**
 * Computes rankings and problem-by-problem stats for a contest.
 */
export const computeContestLeaderboard = async (contestId) => {
  // 1. Fetch contest and its problems (ordered)
  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      problems: {
        orderBy: { order: "asc" },
        select: {
          problemId: true,
          points: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { score: "desc" },
          { penalty: "asc" },
        ],
      },
    },
  });

  if (!contest) return [];

  const contestStartTime = contest.startTime;

  // 2. Fetch all submissions for this contest
  const submissions = await prisma.submission.findMany({
    where: { contestId },
    orderBy: { createdAt: "asc" },
  });

  // 3. For each participant, calculate problem-by-problem details
  const leaderboard = contest.participants.map((p, idx) => {
    const userSubmissions = submissions.filter((s) => s.userId === p.userId);
    const problemStats = {};

    contest.problems.forEach((cp) => {
      const probSubmissions = userSubmissions.filter((s) => s.problemId === cp.problemId);
      const solvedIdx = probSubmissions.findIndex((s) => s.verdict === "ACCEPTED");

      let solved = false;
      let solvedAtMinutes = 0;
      let wrongAttempts = 0;

      const participantStartTime = contest.type === "ROOM" ? contestStartTime : p.startedAt;

      if (solvedIdx !== -1) {
        solved = true;
        const firstAcceptedSub = probSubmissions[solvedIdx];
        const startMs = participantStartTime ? new Date(participantStartTime).getTime() : new Date(contest.createdAt).getTime();
        const solvedMs = new Date(firstAcceptedSub.createdAt).getTime();
        solvedAtMinutes = Math.max(0, Math.floor((solvedMs - startMs) / 60000));

        // Wrong attempts prior to the solved one, ignoring COMPILATION_ERROR
        wrongAttempts = probSubmissions
          .slice(0, solvedIdx)
          .filter((s) => s.verdict !== "ACCEPTED" && s.verdict !== "COMPILATION_ERROR").length;
      } else {
        // All wrong attempts
        wrongAttempts = probSubmissions.filter(
          (s) => s.verdict !== "ACCEPTED" && s.verdict !== "COMPILATION_ERROR"
        ).length;
      }

      problemStats[cp.problemId] = {
        solved,
        solvedAtMinutes,
        attempts: wrongAttempts + (solved ? 1 : 0),
        wrongAttempts,
      };
    });

    return {
      rank: idx + 1,
      userId: p.userId,
      name: p.user.name,
      avatar: p.user.avatar,
      score: p.score,
      penalty: p.penalty,
      startedAt: p.startedAt,
      finishedAt: p.finishedAt,
      problemStats,
    };
  });

  // Re-sort to guarantee correct order
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.penalty - b.penalty;
  });

  // Re-assign ranks based on sorted order
  leaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return leaderboard;
};

/**
 * GET /api/contests/:id/leaderboard
 * Computes rankings for the leaderboard
 */
export const getContestLeaderboard = async (req, res) => {
  try {
    const contestId = req.params.id;
    const leaderboard = await computeContestLeaderboard(contestId);

    res.json({
      status: "success",
      data: {
        leaderboard,
      },
    });
  } catch (error) {
    console.error("❌ Get contest leaderboard error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch leaderboard.",
    });
  }
};

/**
 * GET /api/contests
 * Retrieves all contests created or joined by the user
 */
export const getContests = async (req, res) => {
  try {
    const userId = req.user.id;
    const contests = await prisma.contest.findMany({
      where: {
        OR: [
          { createdBy: userId },
          {
            participants: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        participants: {
          select: {
            userId: true,
            user: {
              select: { name: true }
            }
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      status: "success",
      data: contests,
    });
  } catch (error) {
    console.error("❌ Get contests list error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to load contests list.",
    });
  }
};
