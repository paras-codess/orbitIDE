import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

/**
 * Authentication Middleware
 * Verifies the JWT token from the Authorization header.
 * If valid, attaches the user object to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found. Token may be invalid.",
      });
    }

    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ status: "error", message: "Invalid token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ status: "error", message: "Token expired." });
    }
    return res.status(500).json({ status: "error", message: "Authentication failed." });
  }
};

/**
 * Admin Authorization Middleware
 * Must be used AFTER authenticate middleware.
 * Checks if the authenticated user has the ADMIN role.
 */
export const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

/**
 * Optional Authentication Middleware
 * If a valid JWT is present, attaches user to req.user.
 * If not, proceeds without blocking/error.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    // Silently fail and proceed unauthenticated if token is invalid or expired
    next();
  }
};
