import { Server } from "socket.io";

let io = null;

/**
 * Initialize Socket.io Server instance wrapped around the HTTP server.
 * Sets up CORS and connection listeners.
 * 
 * @param {import("http").Server} httpServer - Node HTTP server instance
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 New WebSocket client connected: ${socket.id}`);

    // Join room specifically created for the individual user
    socket.on("join-user-room", (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`👤 Client ${socket.id} joined private user room: ${userId}`);
      }
    });

    // Join room for custom contests
    socket.on("join-contest-room", (contestId) => {
      if (contestId) {
        socket.join(`contest:${contestId}`);
        console.log(`🏆 Client ${socket.id} joined contest room: contest:${contestId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log("🔌 WebSockets initialized successfully");
  return io;
};

/**
 * Get initialized Socket.io instance.
 * Throws error if accessed before initSocket is called.
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized. Please call initSocket(server) first!");
  }
  return io;
};

/**
 * Emit a submission evaluation update event to a specific user's private room.
 * 
 * @param {string} userId - The target user's UUID
 * @param {Object} payload - The submission verdict details
 * @param {string} payload.submissionId - DB Submission UUID
 * @param {string} payload.verdict - Verdict status (ACCEPTED, WRONG_ANSWER, etc.)
 * @param {number} [payload.executionTime] - Execution runtime in ms
 * @param {number} [payload.memoryUsage] - Memory consumption in KB
 */
export const emitSubmissionVerdict = (userId, payload) => {
  try {
    const activeIo = getIO();
    activeIo.to(userId).emit("submission-verdict", payload);
    console.log(`📤 Live verdict pushed to user room [${userId}] for submission ${payload.submissionId}`);
  } catch (error) {
    console.error("⚠️ Failed to emit live submission verdict over WebSocket:", error.message);
  }
};

/**
 * Emit a leaderboard update event to a specific contest room.
 * 
 * @param {string} contestId - The contest ID
 * @param {Array} leaderboard - The updated leaderboard data
 */
export const emitLeaderboardUpdate = (contestId, leaderboard) => {
  try {
    const activeIo = getIO();
    activeIo.to(`contest:${contestId}`).emit("leaderboard-update", leaderboard);
    console.log(`📤 Leaderboard update pushed to contest room [contest:${contestId}]`);
  } catch (error) {
    console.error("⚠️ Failed to emit leaderboard update over WebSocket:", error.message);
  }
};

/**
 * Emit a contest start event to a specific contest room.
 * 
 * @param {string} contestId - The contest ID
 * @param {string} startTime - The ISO string of start time
 */
export const emitContestStart = (contestId, startTime) => {
  try {
    const activeIo = getIO();
    activeIo.to(`contest:${contestId}`).emit("contest-start", { startTime });
    console.log(`📤 Contest start event emitted to room [contest:${contestId}]`);
  } catch (error) {
    console.error("⚠️ Failed to emit contest start over WebSocket:", error.message);
  }
};
