import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../config/redis.js";

/**
 * Creates a rate limiter instance with Redis store.
 * Falls back to in-memory store if Redis client is not available or throws an error.
 */
const createLimiter = (options) => {
  let store;

  try {
    store = new RedisStore({
      // Use sendCommand for ioredis integration
      sendCommand: (...args) => {
        return redis.call(...args);
      },
      prefix: `rl:orbitide:${process.env.USERNAME || "default"}:`,
    });
  } catch (error) {
    console.warn("⚠️ Rate Limiter falling back to MemoryStore due to Redis initialization issue:", error.message);
  }

  return rateLimit({
    store,
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message: options.message || "Too many requests, please try again later.",
    },
    ...options,
  });
};

export const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: "Too many requests. Please try again after 15 minutes.",
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes
  message: "Too many login/registration attempts. Please try again after 15 minutes.",
});

export const submissionLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: "Submission rate limit exceeded. Please wait 1 minute before trying again.",
});
