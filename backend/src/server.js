import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import prisma from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import problemRoutes from "./routes/problemRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import { generalLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { startSubmissionWorker } from "./services/submissionWorker.js";
import { initSocket } from "./config/socket.js";

// Load environment variables
dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket Server
initSocket(httpServer);

// ------------------------------------
// Middleware
// ------------------------------------
app.use(cors());
app.use(express.json());
app.use("/api", generalLimiter);

// ------------------------------------
// Health Check Route
// ------------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "OrbitIDE AI Backend is running",
    version: "1.0.0",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected", error: error.message });
  }
});

// ------------------------------------
// API Routes
// ------------------------------------
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
// app.use("/api/contests", contestRoutes); // Phase 8

// ------------------------------------
// Global Error Handler
// ------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// ------------------------------------
// Start Server
// ------------------------------------
httpServer.listen(PORT, () => {
  console.log(`\n OrbitIDE AI Backend running on http://localhost:${PORT}`);

  // Start the BullMQ submission worker
  startSubmissionWorker();
  console.log(`📋 Submission queue worker initialized`);
});

export default app;
