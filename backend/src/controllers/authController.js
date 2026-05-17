import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

/**
 * Generates a JWT token for the given user ID.
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * POST /api/auth/register
 * Creates a new user account.
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // --- Validation ---
    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Name, email, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate JWT
    const token = generateToken(user.id);

    res.status(201).json({
      status: "success",
      message: "Account created successfully.",
      data: { user, token },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to create account. Please try again.",
    });
  }
};

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT token.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // --- Validation ---
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    // Compare password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    // Generate JWT
    const token = generateToken(user.id);

    res.json({
      status: "success",
      message: "Login successful.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      status: "error",
      message: "Login failed. Please try again.",
    });
  }
};

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 * Requires: authenticate middleware
 */
export const getMe = async (req, res) => {
  try {
    res.json({
      status: "success",
      data: { user: req.user },
    });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch profile.",
    });
  }
};

/**
 * PUT /api/auth/profile
 * Updates the authenticated user's profile (name, avatar).
 * Requires: authenticate middleware
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(avatar && { avatar }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({
      status: "success",
      message: "Profile updated successfully.",
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("UpdateProfile error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update profile.",
    });
  }
};
