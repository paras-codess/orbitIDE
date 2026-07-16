import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createContest, joinContest, startContest, getContestDetails, getContestLeaderboard } from "./src/controllers/contestController.js";
import { handleContestScoring } from "./src/services/submissionWorker.js";

const prisma = new PrismaClient();

async function runTests() {
  console.log("🚀 Starting Contest Feature Tests...");

  // 1. Ensure test users exist
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("password123", salt);

  const user1 = await prisma.user.upsert({
    where: { email: "contest1@orbitide.com" },
    update: {},
    create: {
      name: "Contestant One",
      email: "contest1@orbitide.com",
      password: passwordHash,
      isVerified: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "contest2@orbitide.com" },
    update: {},
    create: {
      name: "Contestant Two",
      email: "contest2@orbitide.com",
      password: passwordHash,
      isVerified: true,
    },
  });

  console.log(`👤 Users validated: ${user1.name}, ${user2.name}`);

  // Fetch some valid problem IDs
  const problems = await prisma.problem.findMany({ take: 2 });
  if (problems.length < 2) {
    console.error("❌ Test requires at least 2 problems in the database.");
    return;
  }
  const problemIds = problems.map((p) => p.id);
  console.log(`📋 Problems chosen: ${problems.map(p => p.title).join(", ")}`);

  // 2. Test Contest Creation (ROOM type)
  console.log("\n--- Testing Contest Creation (ROOM) ---");
  let mockRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.data = data;
      return this;
    },
  };

  await createContest(
    {
      user: user1,
      body: {
        title: "Team Battle",
        description: "FAANG preparation battle",
        duration: 30,
        type: "ROOM",
        problemIds,
      },
    },
    mockRes
  );

  if (mockRes.data.status !== "success") {
    console.error("❌ Failed to create ROOM contest:", mockRes.data);
    return;
  }

  const contest = mockRes.data.data;
  console.log(`✅ ROOM contest created. ID: ${contest.id}, Code: ${contest.code}`);

  // 3. Test Joining Contest Room
  console.log("\n--- Testing Join Room ---");
  let joinRes = {
    json: function (data) {
      this.data = data;
      return this;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
  };

  await joinContest(
    {
      user: user2,
      body: { code: contest.code },
    },
    joinRes
  );

  if (joinRes.data.status !== "success") {
    console.error("❌ Failed to join room:", joinRes.data);
    return;
  }
  console.log(`✅ User 2 successfully joined. Participant ID: ${joinRes.data.data.participant.id}`);

  // 4. Test Starting Contest Room
  console.log("\n--- Testing Start Room Contest ---");
  let startRes = {
    json: function (data) {
      this.data = data;
      return this;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
  };

  await startContest(
    {
      user: user1, // creator
      params: { id: contest.id },
    },
    startRes
  );

  if (startRes.data.status !== "success") {
    console.error("❌ Failed to start contest:", startRes.data);
    return;
  }
  console.log("✅ Contest started successfully by creator!");

  // Verify that details can now be retrieved
  let detailsRes = {
    json: function (data) {
      this.data = data;
      return this;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
  };

  await getContestDetails(
    {
      user: user2,
      params: { id: contest.id },
    },
    detailsRes
  );

  if (detailsRes.data.status !== "success") {
    console.error("❌ Failed to retrieve contest details:", detailsRes.data);
    return;
  }
  console.log(`✅ Contest details fetched. Total Problems: ${detailsRes.data.data.problems.length}`);

  // 5. Test Scoring Logic
  console.log("\n--- Testing Scoring & Penalty Logic ---");

  // Simulate user 2 submitting first problem as ACCEPTED
  console.log(`Creating dummy accepted submission for ${user2.name}...`);
  const sub1 = await prisma.submission.create({
    data: {
      userId: user2.id,
      problemId: problemIds[0],
      contestId: contest.id,
      language: "javascript",
      code: "console.log('solved');",
      verdict: "ACCEPTED",
    },
  });

  // Execute scoring handler
  await handleContestScoring(contest.id, user2.id, problemIds[0], "ACCEPTED", sub1.id);

  // Fetch updated participant details
  const p2AfterSolve = await prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: contest.id, userId: user2.id } },
  });

  console.log(`📊 Participant stats after solve: Score: ${p2AfterSolve.score}, Penalty: ${p2AfterSolve.penalty} mins`);
  if (p2AfterSolve.score !== 100) {
    console.error("❌ Penalty/Score calculation mismatch!");
    return;
  }
  console.log("✅ Score successfully updated to 100 points.");

  // Test duplicate submission to verify points aren't awarded twice
  console.log("\n--- Testing Duplicate Submission Scoring Protection ---");
  const sub2 = await prisma.submission.create({
    data: {
      userId: user2.id,
      problemId: problemIds[0],
      contestId: contest.id,
      language: "javascript",
      code: "console.log('solved again');",
      verdict: "ACCEPTED",
    },
  });

  await handleContestScoring(contest.id, user2.id, problemIds[0], "ACCEPTED", sub2.id);

  const p2AfterDoubleSolve = await prisma.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: contest.id, userId: user2.id } },
  });

  console.log(`📊 Participant stats after duplicate solve: Score: ${p2AfterDoubleSolve.score}, Penalty: ${p2AfterDoubleSolve.penalty} mins`);
  if (p2AfterDoubleSolve.score !== 100) {
    console.error("❌ Failed duplicate scoring protection test! User got extra points.");
    return;
  }
  console.log("✅ Score protection validated successfully (remained 100 points).");

  // 6. Test Expiration Validation
  console.log("\n--- Testing Timer Expiration Rejection ---");
  // Update contest start time to 1 hour ago (duration is 30 mins, so it's expired)
  const pastTime = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.contest.update({
    where: { id: contest.id },
    data: { startTime: pastTime },
  });
  await prisma.contestParticipant.updateMany({
    where: { contestId: contest.id },
    data: { startedAt: pastTime },
  });

  // Attempt to submit via mock controller logic
  const expiredSubRes = await fetch("http://localhost:5000/api/submissions/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${await generateTokenForUser(user2.id)}`,
    },
    body: JSON.stringify({
      problemId: problemIds[1],
      language: "javascript",
      code: "console.log('too late');",
      contestId: contest.id,
    }),
  });

  const expiredData = await expiredSubRes.json();
  console.log("Submission response for expired contest:", expiredData);
  if (expiredSubRes.status === 400 && expiredData.message.includes("expired")) {
    console.log("✅ Timer expiration validation working perfectly! Submission was rejected.");
  } else {
    console.error("❌ Timer expiration validation failed or was not triggered.");
    return;
  }

  // Cleanup testing rows
  console.log("\n--- Cleaning Up Test Rows ---");
  await prisma.submission.deleteMany({ where: { contestId: contest.id } });
  await prisma.contestParticipant.deleteMany({ where: { contestId: contest.id } });
  await prisma.contestProblem.deleteMany({ where: { contestId: contest.id } });
  await prisma.contest.delete({ where: { id: contest.id } });
  await prisma.user.delete({ where: { id: user1.id } });
  await prisma.user.delete({ where: { id: user2.id } });
  console.log("🧹 Cleanup completed.");

  console.log("\n🎉 ALL CONTEST TESTS COMPLETED SUCCESSFULLY!");
}

import jwt from "jsonwebtoken";
async function generateTokenForUser(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
