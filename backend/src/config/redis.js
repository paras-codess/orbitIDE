import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

console.log(`🔌 Attempting to connect to Redis at: ${redisUrl}`);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    console.warn(`⚠️ Redis reconnection attempt #${times} in ${delay}ms`);
    if (times > 5) {
      console.error("❌ Redis connection failed. Continuing without caching/rate-limiting backend store.");
      return null; // Stop retrying
    }
    return delay;
  },
});

redis.on("connect", () => {
  console.log("✅ Redis client connected successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

export default redis;
