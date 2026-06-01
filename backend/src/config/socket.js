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
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // console.log(`🔌 New WebSocket client connected: ${socket.id}`);

    // Join room specifically created for the individual user
    socket.on("join-user-room", (userId) => {
      if (userId) {
        socket.join(userId);
        // console.log(`👤 Client ${socket.id} joined private user room: ${userId}`);
      }
    });

    socket.on("disconnect", () => {
      // console.log(`🔌 Client disconnected: ${socket.id}`);
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
