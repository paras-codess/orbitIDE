import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const problemsData = [
  {
    title: "Two Sum",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\n### Input Format:\n1. First line contains an integer `N`, the size of the array.\n2. Second line contains `N` space-separated integers representing the array elements.\n3. Third line contains the integer `target`.\n\n### Output Format:\nPrint the two indices separated by a space (e.g. `0 1`).",
    difficulty: "EASY",
    topic: "Arrays",
    subtopic: "Hash Table",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
    inputFormat: "First line: N\nSecond line: N space-separated integers\nThird line: target",
    outputFormat: "Two space-separated indices.",
    sampleInput: "4\n2 7 11 15\n9",
    sampleOutput: "0 1",
    testCases: [
      {
        input: "4\n2 7 11 15\n9\n",
        output: "0 1\n",
        isHidden: false,
      },
      {
        input: "3\n3 2 4\n6\n",
        output: "1 2\n",
        isHidden: false,
      },
      {
        input: "2\n3 3\n6\n",
        output: "0 1\n",
        isHidden: true,
      },
    ],
  },
  {
    title: "Palindrome Number",
    description: "Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.\n\nAn integer is a palindrome when it reads the same backward as forward. For example, `121` is a palindrome while `123` is not.\n\n### Input Format:\nA single integer representing `x`.\n\n### Output Format:\nPrint `true` if it is a palindrome, otherwise print `false`.",
    difficulty: "EASY",
    topic: "Math",
    subtopic: "Basic Math",
    constraints: "-2^31 <= x <= 2^31 - 1",
    inputFormat: "A single line containing the integer x.",
    outputFormat: "true or false",
    sampleInput: "121",
    sampleOutput: "true",
    testCases: [
      {
        input: "121\n",
        output: "true\n",
        isHidden: false,
      },
      {
        input: "-121\n",
        output: "false\n",
        isHidden: false,
      },
      {
        input: "10\n",
        output: "false\n",
        isHidden: true,
      },
    ],
  },
  {
    title: "Valid Parentheses",
    description: "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.\n\n### Input Format:\nA single line containing the bracket string `s`.\n\n### Output Format:\nPrint `true` if valid, otherwise print `false`.",
    difficulty: "EASY",
    topic: "Stacks",
    subtopic: "Strings",
    constraints: "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
    inputFormat: "A single line containing the string s.",
    outputFormat: "true or false",
    sampleInput: "()[]{}",
    sampleOutput: "true",
    testCases: [
      {
        input: "()[]{}\n",
        output: "true\n",
        isHidden: false,
      },
      {
        input: "(]\n",
        output: "false\n",
        isHidden: false,
      },
      {
        input: "([{}])\n",
        output: "true\n",
        isHidden: true,
      },
    ],
  },
  {
    title: "Fibonacci Number",
    description: "The Fibonacci numbers, commonly denoted `F(n)` form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from `0` and `1`. Return `F(n)`.\n\n```\nF(0) = 0, F(1) = 1\nF(n) = F(n - 1) + F(n - 2), for n > 1.\n```\n\n### Input Format:\nA single integer representing `N`.\n\n### Output Format:\nPrint the Fibonacci value `F(N)`.",
    difficulty: "EASY",
    topic: "Dynamic Programming",
    subtopic: "Recursion",
    constraints: "0 <= n <= 30",
    inputFormat: "A single line containing the integer n.",
    outputFormat: "A single integer representing F(n).",
    sampleInput: "4",
    sampleOutput: "3",
    testCases: [
      {
        input: "2\n",
        output: "1\n",
        isHidden: false,
      },
      {
        input: "4\n",
        output: "3\n",
        isHidden: false,
      },
      {
        input: "10\n",
        output: "55\n",
        isHidden: true,
      },
    ],
  },
];

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing problems to prevent duplicate keys
  console.log("🗑️ Clearing existing problems...");
  await prisma.problem.deleteMany();

  // Create problems and test cases
  for (const prob of problemsData) {
    const { testCases, ...problemFields } = prob;
    
    console.log(`📝 Seeding problem: ${prob.title}`);
    await prisma.problem.create({
      data: {
        ...problemFields,
        testCases: {
          create: testCases,
        },
      },
    });
  }

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
