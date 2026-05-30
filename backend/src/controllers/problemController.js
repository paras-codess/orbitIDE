import prisma from "../config/db.js";
import redis from "../config/redis.js";

// Cache TTL: 1 hour (3600 seconds)
const CACHE_TTL = 3600;

/**
 * Helper to clear all problem-related lists from Redis.
 */
const clearProblemListCaches = async () => {
  try {
    const keys = await redis.keys("problems:list:*");
    const topicKeys = await redis.keys("problems:topics");
    const allKeys = [...keys, ...topicKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`🧹 Cleared ${allKeys.length} Redis cache keys for problems`);
    }
  } catch (error) {
    console.error("⚠️ Failed to clear problems cache in Redis:", error.message);
  }
};

/**
 * GET /api/problems
 * Retrieves a list of problems with filtering, search, and pagination.
 * Cached in Redis.
 */
export const getProblems = async (req, res) => {
  try {
    const { page = 1, limit = 10, difficulty, topic, search } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build unique cache key based on query parameters
    const cacheKey = `problems:list:page_${pageNum}:limit_${limitNum}:diff_${difficulty || "all"}:topic_${topic || "all"}:q_${search || "all"}`;

    // Try to get from Redis cache
    if (redis.status === "ready") {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          // console.log("💾 Serving problems list from Redis cache");
          return res.json({
            status: "success",
            source: "cache",
            ...JSON.parse(cachedData),
          });
        }
      } catch (err) {
        console.warn("⚠️ Redis read error in getProblems:", err.message);
      }
    }

    // Build Prisma query filter
    const whereClause = {};

    if (difficulty) {
      whereClause.difficulty = difficulty.toUpperCase();
    }

    if (topic) {
      whereClause.topic = { equals: topic, mode: "insensitive" };
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch count & data in parallel
    const [total, problems] = await Promise.all([
      prisma.problem.count({ where: whereClause }),
      prisma.problem.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        select: {
          id: true,
          title: true,
          difficulty: true,
          topic: true,
          subtopic: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    const responsePayload = {
      data: {
        problems,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      },
    };

    // Store in Redis if connected
    if (redis.status === "ready") {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(responsePayload));
      } catch (err) {
        console.warn("⚠️ Redis write error in getProblems:", err.message);
      }
    }

    return res.json({
      status: "success",
      source: "database",
      ...responsePayload,
    });
  } catch (error) {
    console.error("Get problems error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve problems list.",
    });
  }
};

/**
 * GET /api/problems/topics
 * Returns a list of all distinct topics available.
 * Cached in Redis.
 */
export const getTopics = async (req, res) => {
  try {
    const cacheKey = "problems:topics";

    if (redis.status === "ready") {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          return res.json({
            status: "success",
            source: "cache",
            data: JSON.parse(cachedData),
          });
        }
      } catch (err) {
        console.warn("⚠️ Redis read error in getTopics:", err.message);
      }
    }

    const topicsResult = await prisma.problem.findMany({
      select: { topic: true },
      distinct: ["topic"],
    });

    const topics = topicsResult.map((t) => t.topic).filter(Boolean);

    if (redis.status === "ready") {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(topics));
      } catch (err) {
        console.warn("⚠️ Redis write error in getTopics:", err.message);
      }
    }

    return res.json({
      status: "success",
      source: "database",
      data: topics,
    });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve topics.",
    });
  }
};

/**
 * GET /api/problems/:id
 * Retrieves detailed information about a single problem.
 * Cached in Redis.
 */
export const getProblemById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `problem:detail:${id}`;

    if (redis.status === "ready") {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          // console.log(`💾 Serving problem detail ${id} from Redis cache`);
          return res.json({
            status: "success",
            source: "cache",
            data: JSON.parse(cachedData),
          });
        }
      } catch (err) {
        console.warn(`⚠️ Redis read error in getProblemById for ${id}:`, err.message);
      }
    }

    const problem = await prisma.problem.findUnique({
      where: { id },
      include: {
        testCases: {
          where: { isHidden: false }, // Only return sample/non-hidden test cases to client
          select: {
            id: true,
            input: true,
            output: true,
          },
        },
      },
    });

    if (!problem) {
      return res.status(404).json({
        status: "error",
        message: "Problem not found.",
      });
    }

    if (redis.status === "ready") {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(problem));
      } catch (err) {
        console.warn(`⚠️ Redis write error in getProblemById for ${id}:`, err.message);
      }
    }

    return res.json({
      status: "success",
      source: "database",
      data: problem,
    });
  } catch (error) {
    console.error("Get problem by ID error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve problem details.",
    });
  }
};

/**
 * POST /api/problems
 * Admin-only: Creates a new problem with test cases.
 * Invalidates listing caches.
 */
export const createProblem = async (req, res) => {
  try {
    const { title, description, difficulty, topic, subtopic, constraints, inputFormat, outputFormat, sampleInput, sampleOutput, testCases } = req.body;

    if (!title || !description || !difficulty || !topic) {
      return res.status(400).json({
        status: "error",
        message: "Title, description, difficulty, and topic are required.",
      });
    }

    // Create problem & test cases in a single transaction
    const problem = await prisma.$transaction(async (tx) => {
      const newProblem = await tx.problem.create({
        data: {
          title,
          description,
          difficulty: difficulty.toUpperCase(),
          topic,
          subtopic,
          constraints,
          inputFormat,
          outputFormat,
          sampleInput,
          sampleOutput,
        },
      });

      if (testCases && testCases.length > 0) {
        await tx.testCase.createMany({
          data: testCases.map((tc) => ({
            problemId: newProblem.id,
            input: tc.input,
            output: tc.output,
            isHidden: tc.isHidden !== undefined ? tc.isHidden : true,
          })),
        });
      }

      return newProblem;
    });

    // Invalidate list cache
    await clearProblemListCaches();

    res.status(201).json({
      status: "success",
      message: "Problem created successfully.",
      data: problem,
    });
  } catch (error) {
    console.error("Create problem error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({
        status: "error",
        message: "A problem with this title already exists.",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to create problem.",
    });
  }
};

/**
 * PUT /api/problems/:id
 * Admin-only: Updates an existing problem.
 * Invalidates listing cache and detail cache.
 */
export const updateProblem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingProblem = await prisma.problem.findUnique({ where: { id } });
    if (!existingProblem) {
      return res.status(404).json({
        status: "error",
        message: "Problem not found.",
      });
    }

    // Separate test cases updates if they are passed in body
    const { testCases, ...problemFields } = updateData;

    await prisma.$transaction(async (tx) => {
      // Update problem fields
      if (Object.keys(problemFields).length > 0) {
        if (problemFields.difficulty) problemFields.difficulty = problemFields.difficulty.toUpperCase();
        await tx.problem.update({
          where: { id },
          data: problemFields,
        });
      }

      // If test cases are provided, sync them (delete and recreate is simplest)
      if (testCases) {
        await tx.testCase.deleteMany({ where: { problemId: id } });
        if (testCases.length > 0) {
          await tx.testCase.createMany({
            data: testCases.map((tc) => ({
              problemId: id,
              input: tc.input,
              output: tc.output,
              isHidden: tc.isHidden !== undefined ? tc.isHidden : true,
            })),
          });
        }
      }
    });

    // Invalidate list caches & specific problem cache
    await clearProblemListCaches();
    if (redis.status === "ready") {
      await redis.del(`problem:detail:${id}`);
    }

    res.json({
      status: "success",
      message: "Problem updated successfully.",
    });
  } catch (error) {
    console.error("Update problem error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update problem.",
    });
  }
};

/**
 * DELETE /api/problems/:id
 * Admin-only: Deletes a problem.
 * Invalidates listing cache and detail cache.
 */
export const deleteProblem = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProblem = await prisma.problem.findUnique({ where: { id } });
    if (!existingProblem) {
      return res.status(404).json({
        status: "error",
        message: "Problem not found.",
      });
    }

    // Cascade delete is handled by database level due to onDelete: Cascade on TestCase relation
    await prisma.problem.delete({ where: { id } });

    // Invalidate list caches & specific problem cache
    await clearProblemListCaches();
    if (redis.status === "ready") {
      await redis.del(`problem:detail:${id}`);
    }

    res.json({
      status: "success",
      message: "Problem deleted successfully.",
    });
  } catch (error) {
    console.error("Delete problem error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete problem.",
    });
  }
};
