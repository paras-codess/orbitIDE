import prisma from "./config/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://localhost:5000/api";

async function main() {
  console.log("🏁 Starting submission pipeline test...");

  // 1. Find or create a test user
  let user = await prisma.user.findFirst({
    where: { email: "testuser@orbitide.com" },
  });

  if (!user) {
    console.log("👤 Creating test user...");
    user = await prisma.user.create({
      data: {
        name: "testuser",
        email: "testuser@orbitide.com",
        password: "hashedpassword123", // Dummy password
        role: "USER",
        isVerified: true,
      },
    });
  }
  console.log(`👤 User: ${user.name} (${user.id})`);

  // 2. Generate a JWT token for the user
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "orbitide-super-secret-jwt-key-change-this-in-production", {
    expiresIn: "1h",
  });
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  // 3. Find or create a test problem
  let problem = await prisma.problem.findFirst({
    where: { title: "Reverse String Test" },
  });

  if (!problem) {
    console.log("📝 Creating test problem and test cases...");
    problem = await prisma.problem.create({
      data: {
        title: "Reverse String Test",
        description: "Write a program that reads a line from stdin and prints it back.",
        difficulty: "EASY",
        topic: "Strings",
        testCases: {
          create: [
            {
              input: "hello\n",
              output: "hello\n",
              isHidden: false,
            },
            {
              input: "orbitide\n",
              output: "orbitide\n",
              isHidden: true,
            },
          ],
        },
      },
    });
  }
  console.log(`📝 Problem: "${problem.title}" (${problem.id})`);

  // 4. Submit Python code (which is a simple print(input()))
  const submissionData = {
    problemId: problem.id,
    language: "python",
    code: "import sys\nfor line in sys.stdin:\n    print(line, end='')\n",
  };

  console.log("\n📨 Sending submission to API: POST /api/submissions/submit");
  const response = await fetch(`${API_URL}/submissions/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify(submissionData),
  });

  const responseText = await response.text();
  let resBody;
  try {
    resBody = JSON.parse(responseText);
  } catch (e) {
    console.error("❌ Response is not JSON! Raw text:", responseText);
    return;
  }
  if (response.status !== 202) {
    console.error("❌ Submission failed!", resBody);
    return;
  }

  const { submissionId } = resBody.data;
  console.log(`✅ Success! Status: ${response.status} (Accepted)`);
  console.log(`🆔 Submission ID: ${submissionId}`);

  // 5. Poll status until complete
  console.log("\n⏳ Polling for status updates...");
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    attempts++;
    const statusRes = await fetch(`${API_URL}/submissions/${submissionId}/status`, { headers });
    const statusBody = await statusRes.json();

    if (statusRes.status !== 200) {
      console.error("❌ Error polling status:", statusBody);
      break;
    }

    const sub = statusBody.data;
    console.log(`   [Attempt ${attempts}] Verdict: ${sub.verdict}`);

    if (sub.verdict !== "PENDING") {
      console.log("\n🎉 Code Execution Completed!");
      console.log(`🏆 Final Verdict: ${sub.verdict}`);
      console.log(`⏱️  Execution Time: ${sub.executionTime}ms`);
      console.log(`💾 Memory Usage: ${sub.memoryUsage} KB`);

      // Verify User Stats updated
      const stats = await prisma.userTopicStat.findUnique({
        where: { userId_topic: { userId: user.id, topic: problem.topic } },
      });
      if (stats) {
        console.log("\n📊 User Topic Stats:");
        console.log(`   Topic: ${stats.topic}`);
        console.log(`   Solved: ${stats.solved}`);
        console.log(`   Failed: ${stats.failed}`);
        console.log(`   Accuracy: ${stats.accuracy}%`);
        console.log(`   Confidence Score: ${stats.confidenceScore}%`);
      } else {
        console.log("\n📊 User Topic Stats: No stats created yet (requires successful processing).");
      }
      break;
    }

    // Wait 1.5 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (attempts >= maxAttempts) {
    console.log("\n⚠️ Polling timed out. Check if your BullMQ worker is running and connected.");
  }
}

main()
  .catch((err) => console.error("Error in test script:", err))
  .finally(() => prisma.$disconnect());
