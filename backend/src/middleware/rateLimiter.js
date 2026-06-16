import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../config/redis.js";

/**
 * Creates a rate limiter instance with Redis store.
 * Falls back to in-memory store if Redis client is not available or throws an error.
 */
const createLimiter = (options) => {
  const { prefix = "general", ...rateLimitOptions } = options;
  let store;

  try {
    store = new RedisStore({
      // Use sendCommand for ioredis integration
      // Lazy check: attempt the call and let passOnStoreError handle failures
      sendCommand: (...args) => {
        if (redis.status !== "ready") {
          throw new Error("Redis is not connected");
        }
        return redis.call(...args);
      },
      prefix: `rl:orbitide:${prefix}:${process.env.USERNAME || "default"}:`,
    });
  } catch (error) {
    console.warn("⚠️ Rate Limiter falling back to MemoryStore due to Redis initialization issue:", error.message);
  }

  const rateLimitMessage = rateLimitOptions.message || "Too many requests, please try again later.";

  return rateLimit({
    store,
    passOnStoreError: true, // Fail gracefully and let requests through if Redis disconnects
    windowMs: rateLimitOptions.windowMs || 15 * 60 * 1000,
    max: rateLimitOptions.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Use a handler to guarantee JSON responses
    handler: (req, res) => {
      res.status(429).json({
        status: "error",
        message: rateLimitMessage,
      });
    },
    message: {
      status: "error",
      message: rateLimitMessage,
    },
    ...rateLimitOptions,
  });
};

export const generalLimiter = createLimiter({
  prefix: "general",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: "Too many requests. Please try again after 15 minutes.",
});

export const authLimiter = createLimiter({
  prefix: "auth",
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 minutes
  message: "Too many login/registration attempts. Please try again after 15 minutes.",
});

export const submissionLimiter = createLimiter({
  prefix: "submission",
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (generous for dev; tighten in production)
  message: "Submission rate limit exceeded. Please wait 1 minute before trying again.",
});

