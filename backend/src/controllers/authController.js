import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/emailService.js";

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

    // Email format syntax validation
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Please enter a valid email address.",
      });
    }

    // Username (name) format validation - Developer Style (GitHub-like)
    const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|[ _-](?=[a-zA-Z0-9])){2,19}$/;
    if (!USERNAME_REGEX.test(name)) {
      return res.status(400).json({
        status: "error",
        message:
          "Username must be 3-20 characters, start and end with a letter or number. Spaces, hyphens, and underscores are allowed between words (no consecutive separators).",
      });
    }

    // Reserved words check
    const RESERVED_WORDS = [
      "admin", "administrator", "root", "support", "moderator", "help", "system",
      "orbitide", "orbit", "orbit-ide", "staff",
      "api", "auth", "login", "logout", "settings", "profile", "null", "undefined", "status",
    ];
    if (RESERVED_WORDS.includes(name.toLowerCase())) {
      return res.status(400).json({
        status: "error",
        message: "This username is reserved and cannot be used.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists.",
      });
    }

    // Check if username (name) already exists (case-insensitive)
    const existingName = await prisma.user.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
      },
    });

    if (existingName) {
      return res.status(409).json({
        status: "error",
        message: "This username is already taken.",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate secure email verification token
    const verificationTokenRaw = crypto.randomBytes(32).toString("hex");
    const verificationTokenHashed = crypto
      .createHash("sha256")
      .update(verificationTokenRaw)
      .digest("hex");
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isVerified: false,
        verificationToken: verificationTokenHashed,
        verificationTokenExpires,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });


    // Send verification email
    await sendVerificationEmail(email, verificationTokenRaw);

    res.status(201).json({
      status: "success",
      message: "Account created successfully. Please check your email to verify your account.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
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

    // Check if user has verified their email
    if (!user.isVerified) {
      return res.status(403).json({
        status: "error",
        message: "Please verify your email before logging in.",
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

/**
 * GET /api/auth/verify-email
 * Verifies the user's email using the cryptographically secure token.
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;


    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "Verification token is required.",
      });
    }

    // Hash the incoming raw token to match what is stored in the DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");


    // Find the user by token and ensure it has not expired
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: hashedToken,
        verificationTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification token.",
      });
    }

    // Update user to verified and remove the token fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    res.json({
      status: "success",
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred during verification. Please try again.",
    });
  }
};
