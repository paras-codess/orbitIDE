import prisma from "../config/db.js";
import redis from "../config/redis.js";

/**
 * GET /api/users/stats
 * Retrieves detailed analytics, topic stats, confidence tiers, and recommendations for the user.
 * Cached in Redis for 10 minutes.
 */
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `rl:orbitide:stats:${userId}`;

    // 1. Try to fetch from Redis cache
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
        console.warn("⚠️ Redis read error in getUserStats:", err.message);
      }
    }

    // 2. Fetch all solved problems by the user (unique problem IDs)
    const solvedSubmissions = await prisma.submission.findMany({
      where: {
        userId,
        verdict: "ACCEPTED",
      },
      select: {
        problemId: true,
      },
      distinct: ["problemId"],
    });

    const solvedProblemIds = solvedSubmissions.map((sub) => sub.problemId);

    const solvedProblems = await prisma.problem.findMany({
      where: {
        id: { in: solvedProblemIds },
      },
      select: {
        id: true,
        difficulty: true,
        topic: true,
      },
    });

    // 3. Count total active problems in database grouped by difficulty
    const totalProblemsGrouped = await prisma.problem.groupBy({
      by: ["difficulty"],
      _count: {
        id: true,
      },
    });

    // 4. Build difficulty distribution statistics
    const difficultyStats = {
      EASY: { solved: 0, total: 0 },
      MEDIUM: { solved: 0, total: 0 },
      HARD: { solved: 0, total: 0 },
    };

    solvedProblems.forEach((prob) => {
      if (difficultyStats[prob.difficulty]) {
        difficultyStats[prob.difficulty].solved++;
      }
    });

    totalProblemsGrouped.forEach((group) => {
      if (difficultyStats[group.difficulty]) {
        difficultyStats[group.difficulty].total = group._count.id;
      }
    });

    const totalSolved = solvedProblems.length;
    const totalProblems = Object.values(difficultyStats).reduce(
      (acc, curr) => acc + curr.total,
      0
    );

    // 5. Gather topic statistics
    const allTopicsResult = await prisma.problem.findMany({
      select: { topic: true },
      distinct: ["topic"],
    });
    const allTopics = allTopicsResult.map((t) => t.topic).filter(Boolean);

    const userTopicStats = await prisma.userTopicStat.findMany({
      where: { userId },
      select: {
        topic: true,
        solved: true,
        failed: true,
        accuracy: true,
        confidenceScore: true,
      },
    });

    const topicStatsMap = new Map(
      userTopicStats.map((stat) => [stat.topic.toLowerCase(), stat])
    );

    const topicStats = allTopics.map((topic) => {
      const stat = topicStatsMap.get(topic.toLowerCase());
      return {
        topic,
        solved: stat ? stat.solved : 0,
        failed: stat ? stat.failed : 0,
        accuracy: stat ? stat.accuracy : 0,
        confidenceScore: stat ? stat.confidenceScore : 0,
      };
    });

    // 6. Group into Confidence Tiers
    const confidenceTiers = {
      weak: [],
      medium: [],
      strong: [],
    };

    topicStats.forEach((stat) => {
      const score = stat.confidenceScore;
      if (score < 35) {
        confidenceTiers.weak.push(stat.topic);
      } else if (score < 70) {
        confidenceTiers.medium.push(stat.topic);
      } else {
        confidenceTiers.strong.push(stat.topic);
      }
    });

    // 7. Personalized practice recommendations (up to 5 unsolved problems)
    let recommendedProblems = [];
    const difficultyOrder = { EASY: 1, MEDIUM: 2, HARD: 3 };
    const sortProblems = (a, b) =>
      difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];

    const weakTopics = confidenceTiers.weak;

    if (weakTopics.length > 0) {
      const weakProblems = await prisma.problem.findMany({
        where: {
          id: { notIn: solvedProblemIds },
          topic: { in: weakTopics },
        },
        select: {
          id: true,
          title: true,
          difficulty: true,
          topic: true,
        },
        take: 15, // Fetch slightly more to sort in-memory
      });

      weakProblems.sort(sortProblems);
      recommendedProblems = weakProblems.slice(0, 5);
    }

    if (recommendedProblems.length < 5) {
      const currentIds = recommendedProblems.map((p) => p.id);
      const remainingCount = 5 - recommendedProblems.length;

      const additionalProblems = await prisma.problem.findMany({
        where: {
          id: {
            notIn: [...solvedProblemIds, ...currentIds],
          },
        },
        select: {
          id: true,
          title: true,
          difficulty: true,
          topic: true,
        },
        take: remainingCount,
      });

      recommendedProblems = [...recommendedProblems, ...additionalProblems];
    }

    // 8. Cache response payload in Redis
    const responsePayload = {
      totalSolved,
      totalProblems,
      difficultyStats,
      topicStats,
      confidenceTiers,
      recommendations: recommendedProblems,
    };

    if (redis.status === "ready") {
      try {
        await redis.setex(cacheKey, 600, JSON.stringify(responsePayload));
      } catch (err) {
        console.warn("⚠️ Redis write error in getUserStats:", err.message);
      }
    }

    return res.json({
      status: "success",
      source: "database",
      data: responsePayload,
    });
  } catch (error) {
    console.error("❌ Get user stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to load user analytics.",
    });
  }
};
