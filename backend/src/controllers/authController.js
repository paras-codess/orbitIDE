import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { sendVerificationEmail } from "../services/emailService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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


    // Send verification email (don't let email failure block registration)
    try {
      await sendVerificationEmail(email, verificationTokenRaw);
    } catch (emailError) {
      console.error("Failed to send verification email (user was created):", emailError.message);
      // User is created but email failed — still return success so user isn't stuck
    }

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

    // Block password login for Google-only accounts
    if (user.authProvider === "google" && !user.password) {
      return res.status(401).json({
        status: "error",
        message: "This account uses Google Sign-In. Please log in with Google.",
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

/**
 * POST /api/auth/google
 * Authenticates a user using a Google ID token (credential).
 * If the user is new and has no username, returns needsUsername: true
 * along with a temporary token so the client can set a username.
 */
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        status: "error",
        message: "Google credential is required.",
      });
    }

    // Verify the Google ID token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error("Google verification token error:", err);
      return res.status(401).json({
        status: "error",
        message: "Invalid Google token.",
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, picture } = payload;

    // 1. Check if user already exists by googleId
    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (user) {
      // Existing Google user — log them in
      const token = generateToken(user.id);
      return res.json({
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
    }

    // 2. Check if a user with this email already exists (registered via email/password)
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Link the Google account to the existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatar: user.avatar || picture,
          isVerified: true, // Google email is verified
        },
      });

      const token = generateToken(user.id);
      return res.json({
        status: "success",
        message: "Google account linked and login successful.",
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
    }

    // 3. New user — create account but they need to choose a username
    //    Create with a temporary placeholder name that will be updated
    const tempName = `google_${googleId.slice(0, 8)}_${Date.now()}`;
    user = await prisma.user.create({
      data: {
        name: tempName,
        email,
        googleId,
        avatar: picture || null,
        authProvider: "google",
        isVerified: true,
      },
    });

    // Return a temporary token so the client can call set-username
    const tempToken = generateToken(user.id);
    return res.json({
      status: "success",
      message: "Google sign-in successful. Please choose a username.",
      data: {
        needsUsername: true,
        token: tempToken,
        user: {
          id: user.id,
          email: user.email,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      status: "error",
      message: "Google authentication failed. Please try again.",
    });
  }
};

/**
 * POST /api/auth/google/set-username
 * Sets the username for a newly created Google user.
 * Requires: authenticate middleware (temp token from googleLogin)
 */
export const setGoogleUsername = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Username is required.",
      });
    }

    // Username format validation
    const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|[ _-](?=[a-zA-Z0-9])){2,19}$/;
    if (!USERNAME_REGEX.test(name)) {
      return res.status(400).json({
        status: "error",
        message:
          "Username must be 3-20 characters, start and end with a letter or number. Spaces, hyphens, and underscores are allowed between words.",
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

    // Check if username is already taken
    const existingName = await prisma.user.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        id: { not: req.user.id },
      },
    });

    if (existingName) {
      return res.status(409).json({
        status: "error",
        message: "This username is already taken.",
      });
    }

    // Update the user's name
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
      },
    });

    const token = generateToken(updatedUser.id);

    res.json({
      status: "success",
      message: "Username set successfully.",
      data: {
        user: updatedUser,
        token,
      },
    });
  } catch (error) {
    console.error("Set Google username error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to set username. Please try again.",
    });
  }
};
