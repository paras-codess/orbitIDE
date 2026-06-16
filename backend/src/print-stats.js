import prisma from "./config/db.js";

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: "testuser@orbitide.com" },
    });
    if (!user) {
      console.log("No test user found");
      return;
    }
    const stats = await prisma.userTopicStat.findMany({
      where: { userId: user.id },
    });
    console.log("User stats in database:", stats);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
