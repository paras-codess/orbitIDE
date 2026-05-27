import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------
// Middleware
// ------------------------------------
app.use(cors());
app.use(express.json());

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
app.use("/api/auth", authRoutes);
// app.use("/api/problems", problemRoutes); // Phase 3
// app.use("/api/submissions", submissionRoutes); // Phase 3
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
app.listen(PORT, () => {
  console.log(`\n OrbitIDE AI Backend running on http://localhost:${PORT}`);
  // console.log(`Health check: http://localhost:${PORT}/api/health`);
  // console.log(` Environment: ${process.env.NODE_ENV || "development"}\n`);
});

export default app;
