import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to expand compact problem definitions
function expandProblem(p) {
  let inputFormat = "";
  let outputFormat = "";
  let constraints = "";

  if (p.style === "ARRAY_INT") {
    inputFormat = "First line contains N, the size of the array.\nSecond line contains N space-separated integers.";
    outputFormat = "Print the result.";
    constraints = "1 <= N <= 10^5\n-10^9 <= nums[i] <= 10^9";
  } else if (p.style === "ARRAY_INT_TARGET") {
    inputFormat = "First line contains N, the size of the array, and the target T.\nSecond line contains N space-separated integers.";
    outputFormat = "Print the result.";
    constraints = "1 <= N <= 10^5\n-10^9 <= T, nums[i] <= 10^9";
  } else if (p.style === "STRING") {
    inputFormat = "A single line containing the string S.";
    outputFormat = "Print the result.";
    constraints = "1 <= S.length <= 10^5";
  } else if (p.style === "STRING_TWO") {
    inputFormat = "First line contains string S1.\nSecond line contains string S2.";
    outputFormat = "Print the result.";
    constraints = "1 <= S1.length, S2.length <= 10^5";
  } else if (p.style === "INT_SINGLE") {
    inputFormat = "A single line containing the integer N.";
    outputFormat = "Print the result.";
    constraints = "-10^9 <= N <= 10^9";
  } else {
    inputFormat = p.inputFormat || "Standard input format.";
    outputFormat = p.outputFormat || "Standard output format.";
    constraints = p.constraints || "No special constraints.";
  }

  const fullDescription = `${p.description}\n\n### Input Format:\n${inputFormat}\n\n### Output Format:\n${outputFormat}`;

  return {
    title: p.title,
    description: fullDescription,
    difficulty: p.difficulty,
    topic: p.topic,
    subtopic: p.subtopic || "",
    constraints: constraints,
    inputFormat: inputFormat,
    outputFormat: outputFormat,
    sampleInput: p.sampleInput,
    sampleOutput: p.sampleOutput,
    testCases: p.tests.map((t, index) => ({
      input: t[0].endsWith("\n") ? t[0] : t[0] + "\n",
      output: t[1].endsWith("\n") ? t[1] : t[1] + "\n",
      isHidden: index >= 2
    }))
  };
}

// 1. Existing 5 Problems to keep exactly
const existingProblems = [
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
      { input: "4\n2 7 11 15\n9\n", output: "0 1\n", isHidden: false },
      { input: "3\n3 2 4\n6\n", output: "1 2\n", isHidden: false },
      { input: "2\n3 3\n6\n", output: "0 1\n", isHidden: true }
    ]
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
      { input: "121\n", output: "true\n", isHidden: false },
      { input: "-121\n", output: "false\n", isHidden: false },
      { input: "10\n", output: "false\n", isHidden: true }
    ]
  },
  {
    title: "Valid Parentheses",
    description: "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.\n\n### Input Format:\nA single line containing the bracket string `s`.\n\n### Output Format:\nPrint `true` if valid, otherwise print `false`.",
    difficulty: "EASY",
    topic: "Stack",
    subtopic: "Strings",
    constraints: "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
    inputFormat: "A single line containing the string s.",
    outputFormat: "true or false",
    sampleInput: "()[]{}",
    sampleOutput: "true",
    testCases: [
      { input: "()[]{}\n", output: "true\n", isHidden: false },
      { input: "(]\n", output: "false\n", isHidden: false },
      { input: "([{}])\n", output: "true\n", isHidden: true }
    ]
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
      { input: "2\n", output: "1\n", isHidden: false },
      { input: "4\n", output: "3\n", isHidden: false },
      { input: "10\n", output: "55\n", isHidden: true }
    ]
  },
  {
    title: "Longest Palindromic Substring",
    description: "Given a string `s`, return the **longest palindromic substring** in `s`.\n\nA **palindrome** is a string that reads the same forward and backward.\n\nIf there are multiple longest palindromic substrings of the same length, return the one that appears **first**.\n\n### Examples:\n- `\"babad\"` → `\"bab\"` (both `\"bab\"` and `\"aba\"` are valid, but `\"bab\"` appears first)\n- `\"cbbd\"` → `\"bb\"`\n\n### Input Format:\nA single line containing the string `s`.\n\n### Output Format:\nPrint the longest palindromic substring.",
    difficulty: "MEDIUM",
    topic: "Strings",
    subtopic: "Dynamic Programming",
    constraints: "1 <= s.length <= 1000\ns consists of only digits and English letters.",
    inputFormat: "A single line containing the string s.",
    outputFormat: "The longest palindromic substring.",
    sampleInput: "babad",
    sampleOutput: "bab",
    testCases: [
      { input: "babad\n", output: "bab\n", isHidden: false },
      { input: "cbbd\n", output: "bb\n", isHidden: false },
      { input: "a\n", output: "a\n", isHidden: true },
      { input: "ac\n", output: "a\n", isHidden: true },
      { input: "racecar\n", output: "racecar\n", isHidden: true },
      { input: "aacabdkacaa\n", output: "aca\n", isHidden: true }
    ]
  }
];

// Compact problem specifications
const compactProblems = [
  // === ARRAYS (14 new problems, 1 existing = 15 total) ===
  {
    title: "Contains Duplicate", difficulty: "EASY", topic: "Arrays", subtopic: "Hash Table", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return `true` if any value appears at least twice in the array, and return `false` if every element is distinct.",
    sampleInput: "4\n1 2 3 1", sampleOutput: "true",
    tests: [["4\n1 2 3 1", "true"], ["4\n1 2 3 4", "false"], ["5\n1 1 1 3 3", "true"]]
  },
  {
    title: "Move Zeroes", difficulty: "EASY", topic: "Arrays", subtopic: "Two Pointer", style: "ARRAY_INT",
    description: "Given an integer array `nums`, move all `0`s to the end of it while maintaining the relative order of the non-zero elements.",
    sampleInput: "5\n0 1 0 3 12", sampleOutput: "1 3 12 0 0",
    tests: [["5\n0 1 0 3 12", "1 3 12 0 0"], ["1\n0", "0"], ["4\n4 2 1 0", "4 2 1 0"]]
  },
  {
    title: "Plus One", difficulty: "EASY", topic: "Arrays", subtopic: "Math", style: "ARRAY_INT",
    description: "Given a non-empty array of decimal digits representing a non-negative integer, increment the integer by one. The digits are stored such that the most significant digit is at the head of the list.",
    sampleInput: "3\n1 2 3", sampleOutput: "1 2 4",
    tests: [["3\n1 2 3", "1 2 4"], ["1\n9", "1 0"], ["4\n9 9 9 9", "1 0 0 0 0"]]
  },
  {
    title: "Majority Element", difficulty: "EASY", topic: "Arrays", subtopic: "Hash Table, Greedy", style: "ARRAY_INT",
    description: "Given an array `nums` of size `n`, return the majority element. The majority element is the element that appears more than `⌊n / 2⌋` times.",
    sampleInput: "3\n3 2 3", sampleOutput: "3",
    tests: [["3\n3 2 3", "3"], ["7\n2 2 1 1 1 2 2", "2"], ["1\n5", "5"]]
  },
  {
    title: "Find Pivot Index", difficulty: "EASY", topic: "Arrays", subtopic: "Prefix Sum", style: "ARRAY_INT",
    description: "Given an array of integers `nums`, calculate the pivot index. The pivot index is the index where the sum of all the numbers strictly to the left of the index is equal to the sum of all the numbers strictly to the index's right.",
    sampleInput: "6\n1 7 3 6 5 6", sampleOutput: "3",
    tests: [["6\n1 7 3 6 5 6", "3"], ["3\n1 2 3", "-1"], ["3\n2 1 -1", "0"]]
  },
  {
    title: "Three Sum", difficulty: "MEDIUM", topic: "Arrays", subtopic: "Two Pointer, Sorting", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return all the unique triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`. Print each triplet sorted, space-separated, on a new line.",
    sampleInput: "6\n-1 0 1 2 -1 -4", sampleOutput: "-1 -1 2\n-1 0 1",
    tests: [["6\n-1 0 1 2 -1 -4", "-1 -1 2\n-1 0 1"], ["3\n0 1 1", ""], ["3\n0 0 0", "0 0 0"]]
  },
  {
    title: "Product of Array Except Self", difficulty: "MEDIUM", topic: "Arrays", subtopic: "Prefix Sum", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`. Solve in O(N) time and without using division.",
    sampleInput: "4\n1 2 3 4", sampleOutput: "24 12 8 6",
    tests: [["4\n1 2 3 4", "24 12 8 6"], ["5\n-1 1 0 -3 3", "0 0 9 0 0"], ["3\n1 1 1", "1 1 1"]]
  },
  {
    title: "Merge Intervals", difficulty: "MEDIUM", topic: "Arrays", subtopic: "Sorting", style: "CUSTOM",
    inputFormat: "First line: N (number of intervals).\nNext N lines: two space-separated integers representing the start and end of each interval.",
    outputFormat: "Print the merged intervals as two space-separated integers on each line.",
    description: "Given an array of intervals where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the input intervals.",
    sampleInput: "4\n1 3\n2 6\n8 10\n15 18", sampleOutput: "1 6\n8 10\n15 18",
    tests: [["4\n1 3\n2 6\n8 10\n15 18", "1 6\n8 10\n15 18"], ["2\n1 4\n4 5", "1 5"], ["3\n1 5\n2 3\n8 9", "1 5\n8 9"]]
  },
  {
    title: "Subarray Sum Equals K", difficulty: "MEDIUM", topic: "Arrays", subtopic: "Hash Table, Prefix Sum", style: "ARRAY_INT_TARGET",
    description: "Given an array of integers `nums` and an integer `k`, return the total number of subarrays whose sum equals to `k`.",
    sampleInput: "3 2\n1 1 1", sampleOutput: "2",
    tests: [["3 2\n1 1 1", "2"], ["3 3\n1 2 3", "2"], ["4 0\n0 0 0 0", "10"]]
  },
  {
    title: "Rotate Array", difficulty: "MEDIUM", topic: "Arrays", subtopic: "Two Pointer", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums`, rotate the array to the right by `k` steps, where `k` is non-negative.",
    sampleInput: "7 3\n1 2 3 4 5 6 7", sampleOutput: "5 6 7 1 2 3 4",
    tests: [["7 3\n1 2 3 4 5 6 7", "5 6 7 1 2 3 4"], ["4 2\n-1 -100 3 99", "3 99 -1 -100"], ["2 3\n1 2", "2 1"]]
  },
  {
    title: "First Missing Positive", difficulty: "HARD", topic: "Arrays", subtopic: "Hash Table", style: "ARRAY_INT",
    description: "Given an unsorted integer array `nums`, return the smallest missing positive integer. Run in O(N) time and O(1) auxiliary space.",
    sampleInput: "3\n1 2 0", sampleOutput: "3",
    tests: [["3\n1 2 0", "3"], ["4\n3 4 -1 1", "2"], ["5\n7 8 9 11 12", "1"]]
  },
  {
    title: "Trapping Rain Water", difficulty: "HARD", topic: "Arrays", subtopic: "Two Pointer, Stack", style: "ARRAY_INT",
    description: "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
    sampleInput: "12\n0 1 0 2 1 0 1 3 2 1 2 1", sampleOutput: "6",
    tests: [["12\n0 1 0 2 1 0 1 3 2 1 2 1", "6"], ["6\n4 2 0 3 2 5", "9"], ["3\n3 0 3", "3"]]
  },
  {
    title: "Sliding Window Maximum", difficulty: "HARD", topic: "Arrays", subtopic: "Queue, Heap", style: "ARRAY_INT_TARGET",
    description: "You are given an array of integers `nums`, there is a sliding window of size `k` which is moving from the very left of the array to the very right. You can only see the `k` numbers in the window. Return the max sliding window elements.",
    sampleInput: "8 3\n1 3 -1 -3 5 3 6 7", sampleOutput: "3 3 5 5 6 7",
    tests: [["8 3\n1 3 -1 -3 5 3 6 7", "3 3 5 5 6 7"], ["1 1\n1", "1"], ["4 2\n9 11 8 9", "11 11 9"]]
  },
  {
    title: "Insert Interval", difficulty: "HARD", topic: "Arrays", subtopic: "Sorting", style: "CUSTOM",
    inputFormat: "First line contains N (number of existing intervals) and the new interval start and end (N new_start new_end).\nNext N lines contain start and end of existing intervals.",
    outputFormat: "Print the final interval list after insertion and merging.",
    description: "You are given an array of non-overlapping intervals `intervals` sorted in ascending order. You are also given a `newInterval`. Insert `newInterval` and merge if necessary.",
    sampleInput: "2 2 5\n1 3\n6 9", sampleOutput: "1 5\n6 9",
    tests: [["2 2 5\n1 3\n6 9", "1 5\n6 9"], ["5 4 8\n1 2\n3 5\n6 7\n8 10\n12 16", "1 2\n3 10\n12 16"], ["1 2 7\n1 5", "1 7"]]
  },

  // === STRINGS (14 new problems, 1 existing = 15 total) ===
  {
    title: "Reverse String", difficulty: "EASY", topic: "Strings", subtopic: "Two Pointer", style: "STRING",
    description: "Write a function that reverses a string. The input string is given as a single line.",
    sampleInput: "hello", sampleOutput: "olleh",
    tests: [["hello", "olleh"], ["Hannah", "hannaH"], ["A", "A"]]
  },
  {
    title: "Valid Anagram", difficulty: "EASY", topic: "Strings", subtopic: "Hash Table", style: "STRING_TWO",
    description: "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
    sampleInput: "anagram\nnagaram", sampleOutput: "true",
    tests: [["anagram\nnagaram", "true"], ["rat\ncar", "false"], ["ab\nba", "true"]]
  },
  {
    title: "Longest Common Prefix", difficulty: "EASY", topic: "Strings", subtopic: "Trie", style: "CUSTOM",
    inputFormat: "First line contains integer N (number of strings).\nNext N lines contain a string.",
    outputFormat: "Longest common prefix string. Print empty string if none.",
    description: "Write a function to find the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string.",
    sampleInput: "3\nflower\nflow\nflight", sampleOutput: "fl",
    tests: [["3\nflower\nflow\nflight", "fl"], ["3\ndog\nracecar\ncar", ""], ["2\na\na", "a"]]
  },
  {
    title: "Valid Palindrome", difficulty: "EASY", topic: "Strings", subtopic: "Two Pointer", style: "STRING",
    description: "Given a string `s`, return `true` if it is a palindrome, or `false` otherwise, considering only alphanumeric characters and ignoring cases.",
    sampleInput: "A man, a plan, a canal: Panama", sampleOutput: "true",
    tests: [["A man, a plan, a canal: Panama", "true"], ["race a car", "false"], [" ", "true"]]
  },
  {
    title: "Is Subsequence", difficulty: "EASY", topic: "Strings", subtopic: "Two Pointer", style: "STRING_TWO",
    description: "Given two strings `s` and `t`, return `true` if `s` is a subsequence of `t`, or `false` otherwise.",
    sampleInput: "abc\nahbgdc", sampleOutput: "true",
    tests: [["abc\nahbgdc", "true"], ["axc\nahbgdc", "false"], ["\nahbgdc", "true"]]
  },
  {
    title: "Longest Substring Without Repeating Characters", difficulty: "MEDIUM", topic: "Strings", subtopic: "Sliding Window", style: "STRING",
    description: "Given a string `s`, find the length of the longest substring without repeating characters.",
    sampleInput: "abcabcbb", sampleOutput: "3",
    tests: [["abcabcbb", "3"], ["bbbbb", "1"], ["pwwkew", "3"]]
  },
  {
    title: "Group Anagrams", difficulty: "MEDIUM", topic: "Strings", subtopic: "Hash Table", style: "CUSTOM",
    inputFormat: "First line: N (number of strings).\nSecond line: N space-separated strings.",
    outputFormat: "Print grouped anagrams. Groups should be sorted alphabetically, and groups outputted sorted by first element.",
    description: "Given an array of strings `strs`, group the anagrams together. You can return the answer in any order.",
    sampleInput: "6\neat tea tan ate nat bat", sampleOutput: "bat\neat ate tea\nnat tan",
    tests: [["6\neat tea tan ate nat bat", "bat\neat ate tea\nnat tan"], ["1\na", "a"], ["2\na b", "a\nb"]]
  },
  {
    title: "String to Integer (atoi)", difficulty: "MEDIUM", topic: "Strings", subtopic: "Math", style: "STRING",
    description: "Implement the `myAtoi(string s)` function, which converts a string to a 32-bit signed integer. Follow clamping rules for underflow/overflow.",
    sampleInput: "   -42", sampleOutput: "-42",
    tests: [["   -42", "-42"], ["4193 with words", "4193"], ["words and 987", "0"]]
  },
  {
    title: "Decode String", difficulty: "MEDIUM", topic: "Strings", subtopic: "Stack", style: "STRING",
    description: "Given an encoded string, return its decoded string. The encoding rule is: `k[encoded_string]`, where the `encoded_string` inside the square brackets is being repeated exactly `k` times.",
    sampleInput: "3[a]2[bc]", sampleOutput: "aaabcbc",
    tests: [["3[a]2[bc]", "aaabcbc"], ["3[a2[c]]", "accaccacc"], ["2[abc]3[cd]ef", "abcabccdcdcdef"]]
  },
  {
    title: "Minimum Window Substring", difficulty: "HARD", topic: "Strings", subtopic: "Sliding Window", style: "STRING_TWO",
    description: "Given two strings `s` and `t` of lengths `m` and `n` respectively, return the minimum window substring of `s` such that every character in `t` (including duplicates) is included in the window. If there is no such substring, return the empty string.",
    sampleInput: "ADOBECODEBANC\nABC", sampleOutput: "BANC",
    tests: [["ADOBECODEBANC\nABC", "BANC"], ["a\na", "a"], ["a\naa", ""]]
  },
  {
    title: "Edit Distance", difficulty: "HARD", topic: "Strings", subtopic: "Dynamic Programming", style: "STRING_TWO",
    description: "Given two strings `word1` and `word2`, return the minimum number of operations required to convert `word1` to `word2`. Operations are insert, delete, replace.",
    sampleInput: "horse\nros", sampleOutput: "3",
    tests: [["horse\nros", "3"], ["intention\nexecution", "5"], ["a\n", "1"]]
  },
  {
    title: "Regular Expression Matching", difficulty: "HARD", topic: "Strings", subtopic: "Dynamic Programming", style: "STRING_TWO",
    description: "Given an input string `s` and a pattern `p`, implement regular expression matching with support for `.` and `*`.",
    sampleInput: "aa\na*", sampleOutput: "true",
    tests: [["aa\na*", "true"], ["ab\n.*", "true"], ["aab\nc*a*b", "true"]]
  },
  {
    title: "Distinct Subsequences", difficulty: "HARD", topic: "Strings", subtopic: "Dynamic Programming", style: "STRING_TWO",
    description: "Given two strings `s` and `t`, return the number of distinct subsequences of `s` which equals `t`.",
    sampleInput: "rabbbit\nrabbit", sampleOutput: "3",
    tests: [["rabbbit\nrabbit", "3"], ["babgbag\nbag", "5"], ["a\nb", "0"]]
  },
  {
    title: "Orderly Queue", difficulty: "HARD", topic: "Strings", subtopic: "Greedy", style: "CUSTOM",
    inputFormat: "First line: S (string).\nSecond line: K (integer, max rotations).",
    outputFormat: "Lexicographically smallest string.",
    description: "You are given a string `s` and an integer `k`. You can choose one of the first `k` letters of `s` and append it to the end of the string. Return the lexicographically smallest string you can have after any number of moves.",
    sampleInput: "cba\n1", sampleOutput: "acb",
    tests: [["cba\n1", "acb"], ["baaca\n3", "aaacb"], ["xyz\n2", "xyz"]]
  },

  // === BINARY SEARCH (15 problems) ===
  {
    title: "Binary Search", difficulty: "EASY", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, then return its index. Otherwise, return `-1`.",
    sampleInput: "6 9\n-1 0 3 5 9 12", sampleOutput: "4",
    tests: [["6 9\n-1 0 3 5 9 12", "4"], ["6 2\n-1 0 3 5 9 12", "-1"], ["1 5\n5", "0"]]
  },
  {
    title: "Search Insert Position", difficulty: "EASY", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order.",
    sampleInput: "4 5\n1 3 5 6", sampleOutput: "2",
    tests: [["4 5\n1 3 5 6", "2"], ["4 2\n1 3 5 6", "1"], ["4 7\n1 3 5 6", "4"]]
  },
  {
    title: "First Bad Version", difficulty: "EASY", topic: "Binary Search", subtopic: "Interactive", style: "CUSTOM",
    inputFormat: "First line: N (number of versions).\nSecond line: B (first bad version).",
    outputFormat: "Index of first bad version.",
    description: "You are a product manager and currently leading a team to develop a new product. Unfortunately, the latest version of your product fails the quality check. Since each version is developed based on the previous version, all the versions after a bad version are also bad. Find the first bad version.",
    sampleInput: "5\n4", sampleOutput: "4",
    tests: [["5\n4", "4"], ["1\n1", "1"], ["10\n3", "3"]]
  },
  {
    title: "Sqrt(x)", difficulty: "EASY", topic: "Binary Search", subtopic: "Math", style: "INT_SINGLE",
    description: "Given a non-negative integer `x`, compute and return the square root of `x`. Since the return type is an integer, the decimal digits are truncated, and only the integer part of the result is returned.",
    sampleInput: "8", sampleOutput: "2",
    tests: [["8", "2"], ["4", "2"], ["0", "0"]]
  },
  {
    title: "Guess Number Higher or Lower", difficulty: "EASY", topic: "Binary Search", subtopic: "Interactive", style: "CUSTOM",
    inputFormat: "First line: N (max number).\nSecond line: P (picked number).",
    outputFormat: "The picked number P.",
    description: "We are playing the Guess Game. The game is as follows: I choose a number from `1` to `n`. You have to guess which number I chose. Every time you guess wrong, I will tell you whether the number I chose is higher or lower than your guess.",
    sampleInput: "10\n6", sampleOutput: "6",
    tests: [["10\n6", "6"], ["3\n1", "1"], ["1\n1", "1"]]
  },
  {
    title: "Search in Rotated Sorted Array", difficulty: "MEDIUM", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "There is an integer array `nums` sorted in ascending order (with distinct values), which is possibly rotated. Given the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.",
    sampleInput: "7 0\n4 5 6 7 0 1 2", sampleOutput: "4",
    tests: [["7 0\n4 5 6 7 0 1 2", "4"], ["7 3\n4 5 6 7 0 1 2", "-1"], ["1 0\n1", "-1"]]
  },
  {
    title: "Find Minimum in Rotated Sorted Array", difficulty: "MEDIUM", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Suppose an array of length `n` sorted in ascending order is rotated between `1` and `n` times. Given the sorted rotated array `nums` of unique elements, return the minimum element of this array.",
    sampleInput: "5\n3 4 5 1 2", sampleOutput: "1",
    tests: [["5\n3 4 5 1 2", "1"], ["7\n4 5 6 7 0 1 2", "0"], ["4\n11 13 15 17", "11"]]
  },
  {
    title: "Find Peak Element", difficulty: "MEDIUM", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT",
    description: "A peak element is an element that is strictly greater than its neighbors. Given a 0-indexed integer array `nums`, find a peak element, and return its index. If the array contains multiple peaks, return the index to any of the peaks.",
    sampleInput: "4\n1 2 3 1", sampleOutput: "2",
    tests: [["4\n1 2 3 1", "2"], ["7\n1 2 1 3 5 6 4", "5"], ["1\n5", "0"]]
  },
  {
    title: "Koko Eating Bananas", difficulty: "MEDIUM", topic: "Binary Search", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: N (number of piles) and H (hours).\nSecond line: N integers representing bananas in each pile.",
    outputFormat: "Minimum eating speed K.",
    description: "Koko loves to eat bananas. There are `n` piles of bananas, the `i`-th pile has `piles[i]` bananas. The guards have gone and will come back in `h` hours. Koko decides her bananas-per-hour eating speed of `k`. Return the minimum integer `k` such that she can eat all the bananas within `h` hours.",
    sampleInput: "4 8\n3 6 7 11", sampleOutput: "4",
    tests: [["4 8\n3 6 7 11", "4"], ["5 5\n30 11 23 4 20", "30"], ["5 6\n30 11 23 4 20", "23"]]
  },
  {
    title: "Search a 2D Matrix", difficulty: "MEDIUM", topic: "Binary Search", subtopic: "Matrix", style: "CUSTOM",
    inputFormat: "First line: M (rows), N (cols), T (target).\nNext M lines: N space-separated integers representing the matrix row.",
    outputFormat: "true or false",
    description: "Write an efficient algorithm that searches for a value `target` in an `m x n` integer matrix `matrix`. This matrix has sorted rows, and the first integer of each row is greater than the last integer of the previous row.",
    sampleInput: "3 4 3\n1 3 5 7\n10 11 16 20\n23 30 34 60", sampleOutput: "true",
    tests: [["3 4 3\n1 3 5 7\n10 11 16 20\n23 30 34 60", "true"], ["3 4 13\n1 3 5 7\n10 11 16 20\n23 30 34 60", "false"], ["1 1 5\n5", "true"]]
  },
  {
    title: "Median of Two Sorted Arrays", difficulty: "HARD", topic: "Binary Search", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: N (size of nums1) and M (size of nums2).\nSecond line: N integers (nums1).\nThird line: M integers (nums2).",
    outputFormat: "Median as float with 5 decimal places.",
    description: "Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).",
    sampleInput: "2 1\n1 3\n2", sampleOutput: "2.00000",
    tests: [["2 1\n1 3\n2", "2.00000"], ["2 2\n1 2\n3 4", "2.50000"], ["1 0\n0\n", "0.00000"]]
  },
  {
    title: "Split Array Largest Sum", difficulty: "HARD", topic: "Binary Search", subtopic: "Greedy", style: "CUSTOM",
    inputFormat: "First line: N (array size) and K (subarrays split limit).\nSecond line: N space-separated integers.",
    outputFormat: "Minimized largest sum.",
    description: "Given an integer array `nums` and an integer `k`, split `nums` into `k` non-empty contiguous subarrays such that the largest sum of any subarray is minimized. Return the minimized largest sum.",
    sampleInput: "5 2\n7 2 5 10 8", sampleOutput: "18",
    tests: [["5 2\n7 2 5 10 8", "18"], ["5 2\n1 2 3 4 5", "9"], ["3 3\n1 4 4", "4"]]
  },
  {
    title: "Find Minimum in Rotated Sorted Array II", difficulty: "HARD", topic: "Binary Search", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Suppose an array of length `n` sorted in ascending order is rotated between `1` and `n` times. The array may contain duplicates. Find the minimum element of this array. Solve in average O(log N) time.",
    sampleInput: "5\n2 2 2 0 1", sampleOutput: "0",
    tests: [["5\n2 2 2 0 1", "0"], ["3\n1 3 5", "1"], ["7\n10 1 10 10 10 10 10", "1"]]
  },
  {
    title: "Median in Data Stream", difficulty: "HARD", topic: "Binary Search", subtopic: "Heap", style: "CUSTOM",
    inputFormat: "First line: N (number of stream queries).\nNext N lines: Command and values. 'add X' to add integer X to stream, 'find' to output the current median.",
    outputFormat: "Median outputs from 'find' command.",
    description: "The median is the middle value in an ordered integer list. Implement a MedianFinder class that supports adding numbers and finding the current median.",
    sampleInput: "4\nadd 1\nadd 2\nfind\nadd 3\nfind", sampleOutput: "1.50000\n2.00000",
    tests: [["4\nadd 1\nadd 2\nfind\nadd 3\nfind", "1.50000\n2.00000"], ["3\nadd 5\nfind\nadd 10\nfind", "5.00000\n7.50000"]]
  },
  {
    title: "Count of Smaller Numbers After Self", difficulty: "HARD", topic: "Binary Search", subtopic: "Binary Indexed Tree", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return an integer array `counts` where `counts[i]` is the number of smaller elements to the right of `nums[i]`.",
    sampleInput: "4\n5 2 6 1", sampleOutput: "2 1 1 0",
    tests: [["4\n5 2 6 1", "2 1 1 0"], ["1\n-1", "0"], ["2\n-1 -1", "0 0"]]
  },

  // === TWO POINTER (15 problems) ===
  {
    title: "Merge Sorted Array", difficulty: "EASY", topic: "Two Pointer", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: M (elements in nums1) and N (elements in nums2).\nSecond line: M sorted integers representing nums1.\nThird line: N sorted integers representing nums2.",
    outputFormat: "Merged sorted list of elements.",
    description: "You are given two integer arrays `nums1` and `nums2`, sorted in non-decreasing order. Merge `nums2` into `nums1` as one sorted array.",
    sampleInput: "3 3\n1 2 3\n2 5 6", sampleOutput: "1 2 2 3 5 6",
    tests: [["3 3\n1 2 3\n2 5 6", "1 2 2 3 5 6"], ["1 0\n1\n", "1"], ["0 1\n\n1", "1"]]
  },
  {
    title: "Remove Duplicates from Sorted Array", difficulty: "EASY", topic: "Two Pointer", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an integer array `nums` sorted in non-decreasing order, remove the duplicates in-place such that each unique element appears only once. Return the sorted non-duplicate elements.",
    sampleInput: "3\n1 1 2", sampleOutput: "1 2",
    tests: [["3\n1 1 2", "1 2"], ["10\n0 0 1 1 1 2 2 3 3 4", "0 1 2 3 4"], ["1\n1", "1"]]
  },
  {
    title: "Remove Element", difficulty: "EASY", topic: "Two Pointer", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums` and an value `val`, remove all occurrences of `val` in `nums` in-place. Return the remaining array elements.",
    sampleInput: "4 3\n3 2 2 3", sampleOutput: "2 2",
    tests: [["4 3\n3 2 2 3", "2 2"], ["8 2\n0 1 2 2 3 0 4 2", "0 1 3 0 4"], ["1 1\n1", ""]]
  },
  {
    title: "Two Sum II - Input Array Is Sorted", difficulty: "EASY", topic: "Two Pointer", subtopic: "Binary Search", style: "ARRAY_INT_TARGET",
    description: "Given a 1-indexed array of integers `numbers` that is already sorted in non-decreasing order, find two numbers such that they add up to a specific `target` number. Return their indices (1-indexed).",
    sampleInput: "4 9\n2 7 11 15", sampleOutput: "1 2",
    tests: [["4 9\n2 7 11 15", "1 2"], ["3 6\n2 3 4", "1 3"], ["2 -1\n-8 -1", "1 2"]]
  },
  {
    title: "Reverse Vowels of a String", difficulty: "EASY", topic: "Two Pointer", subtopic: "Strings", style: "STRING",
    description: "Given a string `s`, reverse only all the vowels in the string and return it.",
    sampleInput: "hello", sampleOutput: "holle",
    tests: [["hello", "holle"], ["leetcode", "leotcede"], ["a", "a"]]
  },
  {
    title: "Container With Most Water", difficulty: "MEDIUM", topic: "Two Pointer", subtopic: "Greedy", style: "ARRAY_INT",
    description: "Given `n` non-negative integers `height` representing vertical lines, find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum volume.",
    sampleInput: "9\n1 8 6 2 5 4 8 3 7", sampleOutput: "49",
    tests: [["9\n1 8 6 2 5 4 8 3 7", "49"], ["2\n1 1", "1"], ["4\n4 3 2 1", "4"]]
  },
  {
    title: "3Sum Closest", difficulty: "MEDIUM", topic: "Two Pointer", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums` of length `n` and an integer `target`, find three integers in `nums` such that the sum is closest to `target`. Return the sum of the three integers.",
    sampleInput: "4 1\n-1 2 1 -4", sampleOutput: "2",
    tests: [["4 1\n-1 2 1 -4", "2"], ["3 1\n0 0 0", "0"], ["4 100\n1 1 1 1", "3"]]
  },
  {
    title: "Valid Palindrome II", difficulty: "MEDIUM", topic: "Two Pointer", subtopic: "Strings", style: "STRING",
    description: "Given a string `s`, return `true` if the `s` can be palindrome after deleting at most one character from it.",
    sampleInput: "aba", sampleOutput: "true",
    tests: [["aba", "true"], ["abca", "true"], ["abc", "false"]]
  },
  {
    title: "Compare Version Numbers", difficulty: "MEDIUM", topic: "Two Pointer", subtopic: "Strings", style: "STRING_TWO",
    description: "Given two version strings, `version1` and `version2`, compare them. If `version1` < `version2` return `-1`, if `version1` > `version2` return `1`, otherwise return `0`.",
    sampleInput: "1.01\n1.001", sampleOutput: "0",
    tests: [["1.01\n1.001", "0"], ["1.0\n1.0.0", "0"], ["0.1\n1.1", "-1"]]
  },
  {
    title: "3Sum Smaller", difficulty: "MEDIUM", topic: "Two Pointer", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given an array of `n` integers `nums` and a `target`, find the number of index triplets `i, j, k` with `0 <= i < j < k < n` that satisfy the condition `nums[i] + nums[j] + nums[k] < target`.",
    sampleInput: "4 2\n-2 0 1 3", sampleOutput: "2",
    tests: [["4 2\n-2 0 1 3", "2"], ["1 0\n0", "0"], ["3 4\n1 1 1", "1"]]
  },
  {
    title: "Subarrays with K Different Integers", difficulty: "HARD", topic: "Two Pointer", subtopic: "Sliding Window", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums` and an integer `k`, return the number of good subarrays of `nums`. A good subarray is one where the number of different integers is exactly `k`.",
    sampleInput: "5 2\n1 2 1 2 3", sampleOutput: "7",
    tests: [["5 2\n1 2 1 2 3", "7"], ["5 3\n1 2 1 3 4", "3"]]
  },
  {
    title: "Valid Palindrome III", difficulty: "HARD", topic: "Two Pointer", subtopic: "Dynamic Programming", style: "CUSTOM",
    inputFormat: "First line: S (string).\nSecond line: K (max deletions allowed).",
    outputFormat: "true or false",
    description: "Given a string `s` and an integer `k`, return `true` if `s` is a `k`-palindrome. A string is a `k`-palindrome if it can be transformed into a palindrome by removing at most `k` characters.",
    sampleInput: "abcdeca\n2", sampleOutput: "true",
    tests: [["abcdeca\n2", "true"], ["abbab\n1", "true"], ["abc\n1", "false"]]
  },
  {
    title: "Palindrome Pairs", difficulty: "HARD", topic: "Two Pointer", subtopic: "Trie", style: "CUSTOM",
    inputFormat: "First line: N (number of words).\nNext N lines: A single string representing each word.",
    outputFormat: "Print list of pairs of indices (0-indexed) that form a palindrome, space-separated on new lines.",
    description: "Given a list of unique words, return all pairs of distinct indices `(i, j)` in the given list, so that the concatenation of the two words, i.e. `words[i] + words[j]` is a palindrome.",
    sampleInput: "4\nabcd\ndcba\nlls\ns", sampleOutput: "0 1\n1 0\n2 3",
    tests: [["4\nabcd\ndcba\nlls\ns", "0 1\n1 0\n2 3"], ["2\nbat\ntab", "0 1\n1 0"], ["1\na", ""]]
  },
  {
    title: "Minimum Window Subsequence", difficulty: "HARD", topic: "Two Pointer", subtopic: "Dynamic Programming", style: "STRING_TWO",
    description: "Given strings `S1` and `S2`, find the minimum contiguous substring `W` of `S1` such that `S2` is a subsequence of `W`. If there is no such window in `S1`, return the empty string.",
    sampleInput: "abcdebdde\nbde", sampleOutput: "bcde",
    tests: [["abcdebdde\nbde", "bcde"], ["abc\nd", ""], ["abcfde\nbce", "abcfde"]]
  },
  {
    title: "Max Chunks To Make Sorted II", difficulty: "HARD", topic: "Two Pointer", subtopic: "Stack", style: "ARRAY_INT",
    description: "We split the array into some number of 'chunks' (partitions), and individually sort each chunk. After concatenating them, the result equals the sorted array. Return the maximum number of chunks we can partition.",
    sampleInput: "5\n2 1 3 4 4", sampleOutput: "4",
    tests: [["5\n2 1 3 4 4", "4"], ["5\n5 4 3 2 1", "1"]]
  },

  // === SLIDING WINDOW (15 problems) ===
  {
    title: "Maximum Average Subarray I", difficulty: "EASY", topic: "Sliding Window", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "You are given an integer array `nums` consisting of `n` elements, and an integer `k`. Find a contiguous subarray whose length is equal to `k` that has the maximum average value.",
    sampleInput: "6 4\n1 12 -5 -6 50 3", sampleOutput: "12.75000",
    tests: [["6 4\n1 12 -5 -6 50 3", "12.75000"], ["1 1\n5", "5.00000"]]
  },
  {
    title: "Minimum Difference Between Highest and Lowest of K Scores", difficulty: "EASY", topic: "Sliding Window", subtopic: "Sorting", style: "ARRAY_INT_TARGET",
    description: "You are given a 0-indexed integer array `nums`, where `nums[i]` represents the score of the `i`-th student. You are also given an integer `k`. Pick `k` scores and minimize the difference between highest and lowest.",
    sampleInput: "4 2\n9 4 1 7", sampleOutput: "2",
    tests: [["4 2\n9 4 1 7", "2"], ["1 1\n90", "0"]]
  },
  {
    title: "Longest Nice Substring", difficulty: "EASY", topic: "Sliding Window", subtopic: "Strings", style: "STRING",
    description: "A string `s` is nice if, for every letter of the alphabet, if both its uppercase and lowercase versions are in `s`. Return the longest nice substring of `s`.",
    sampleInput: "YazaAay", sampleOutput: "aAa",
    tests: [["YazaAay", "aAa"], ["Bb", "Bb"], ["c", ""]]
  },
  {
    title: "Defuse the Bomb", difficulty: "EASY", topic: "Sliding Window", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "You have a circular bomb code. If `k > 0`, replace each number with the sum of the next `k` numbers. If `k < 0`, replace with previous `k`. If `k == 0`, replace with `0`.",
    sampleInput: "4 3\n5 7 1 4", sampleOutput: "12 10 16 13",
    tests: [["4 3\n5 7 1 4", "12 10 16 13"], ["4 0\n1 2 3 4", "0 0 0 0"], ["4 -2\n2 4 9 3", "12 5 6 13"]]
  },
  {
    title: "Check If a String Contains All Binary Codes of Size K", difficulty: "EASY", topic: "Sliding Window", subtopic: "Bit Manipulation", style: "CUSTOM",
    inputFormat: "First line: S (string of 0s and 1s).\nSecond line: K (size of binary code).",
    outputFormat: "true or false",
    description: "Given a binary string `s` and an integer `k`, return `true` if every binary code of length `k` is a substring of `s`. Otherwise, return `false`.",
    sampleInput: "00110110\n2", sampleOutput: "true",
    tests: [["00110110\n2", "true"], ["0110\n1", "true"], ["0110\n2", "false"]]
  },
  {
    title: "Minimum Size Subarray Sum", difficulty: "MEDIUM", topic: "Sliding Window", subtopic: "Two Pointer", style: "ARRAY_INT_TARGET",
    description: "Given an array of positive integers `nums` and a positive integer `target`, return the minimal length of a contiguous subarray of which the sum is greater than or equal to `target`. If there is no such subarray, return `0` instead.",
    sampleInput: "6 7\n2 3 1 2 4 3", sampleOutput: "2",
    tests: [["6 7\n2 3 1 2 4 3", "2"], ["3 4\n1 4 4", "1"], ["8 11\n1 1 1 1 1 1 1 1", "0"]]
  },
  {
    title: "Permutation in String", difficulty: "MEDIUM", topic: "Sliding Window", subtopic: "Hash Table", style: "STRING_TWO",
    description: "Given two strings `s1` and `s2`, return `true` if `s2` contains a permutation of `s1`, or `false` otherwise. In other words, one of `s1`'s permutations is the substring of `s2`.",
    sampleInput: "ab\neidbaooo", sampleOutput: "true",
    tests: [["ab\neidbaooo", "true"], ["ab\neidboaoo", "false"]]
  },
  {
    title: "Longest Repeating Character Replacement", difficulty: "MEDIUM", topic: "Sliding Window", subtopic: "Hash Table", style: "CUSTOM",
    inputFormat: "First line: S (string).\nSecond line: K (max replacements).",
    outputFormat: "Longest repeating character substring length.",
    description: "You are given a string `s` and an integer `k`. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most `k` times.",
    sampleInput: "ABAB\n2", sampleOutput: "4",
    tests: [["ABAB\n2", "4"], ["AABABBA\n1", "4"]]
  },
  {
    title: "Max Consecutive Ones III", difficulty: "MEDIUM", topic: "Sliding Window", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "Given a binary array `nums` and an integer `k`, return the maximum number of consecutive `1`s in the array if you can flip at most `k` `0`s.",
    sampleInput: "11 2\n1 1 1 0 0 0 1 1 1 1 0", sampleOutput: "6",
    tests: [["11 2\n1 1 1 0 0 0 1 1 1 1 0", "6"], ["19 3\n0 0 1 1 0 0 1 1 1 0 1 1 0 0 0 1 1 1 1", "10"]]
  },
  {
    title: "Fruits into Baskets", difficulty: "MEDIUM", topic: "Sliding Window", subtopic: "Arrays", style: "ARRAY_INT",
    description: "You have two baskets, and each basket can carry any quantity of fruit, but only one type of fruit per basket. Find the maximum number of fruits you can collect in a continuous sequence.",
    sampleInput: "4\n1 2 3 2 2", sampleOutput: "4",
    tests: [["5\n1 2 3 2 2", "4"], ["3\n1 2 1", "3"], ["4\n0 1 2 2", "3"]]
  },
  {
    title: "Longest Substring with At Most K Distinct Characters", difficulty: "HARD", topic: "Sliding Window", subtopic: "Strings", style: "CUSTOM",
    inputFormat: "First line: S (string).\nSecond line: K (max distinct characters).",
    outputFormat: "Length of longest substring.",
    description: "Given a string `s` and an integer `k`, return the length of the longest substring of `s` that contains at most `k` distinct characters.",
    sampleInput: "eceba\n2", sampleOutput: "3",
    tests: [["eceba\n2", "3"], ["aa\n1", "2"], ["a\n0", "0"]]
  },
  {
    title: "Smallest Range Covering Elements from K Lists", difficulty: "HARD", topic: "Sliding Window", subtopic: "Heap", style: "CUSTOM",
    inputFormat: "First line: K (number of lists).\nNext K lines: First integer M is the size of the list, followed by M sorted integers.",
    outputFormat: "Two space-separated integers representing the smallest range.",
    description: "You have `k` lists of sorted integers in non-decreasing order. Find the smallest range that includes at least one number from each of the `k` lists.",
    sampleInput: "3\n5 4 10 15 24 26\n4 0 9 12 20\n4 5 18 22 30", sampleOutput: "20 24",
    tests: [["3\n5 4 10 15 24 26\n4 0 9 12 20\n4 5 18 22 30", "20 24"], ["3\n3 1 2 3\n3 1 2 3\n3 1 2 3", "1 1"]]
  },

  // === HASHMAP (15 problems) ===
  {
    title: "Intersection of Two Arrays", difficulty: "EASY", topic: "HashMap", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: M (nums1 size) and N (nums2 size).\nSecond line: M space-separated integers.\nThird line: N space-separated integers.",
    outputFormat: "Space separated list of unique intersection elements (sorted).",
    description: "Given two integer arrays `nums1` and `nums2`, return an array of their intersection. Each element in the result must be unique and you may return the result in sorted order.",
    sampleInput: "4 2\n1 2 2 1\n2 2", sampleOutput: "2",
    tests: [["4 2\n1 2 2 1\n2 2", "2"], ["3 3\n4 9 5\n9 4 9 8 4", "4 9"]]
  },
  {
    title: "Unique Number of Occurrences", difficulty: "EASY", topic: "HashMap", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an array of integers `arr`, return `true` if the number of occurrences of each value in the array is unique, or `false` otherwise.",
    sampleInput: "6\n1 2 2 1 1 3", sampleOutput: "true",
    tests: [["6\n1 2 2 1 1 3", "true"], ["2\n1 2", "false"], ["10\n-3 0 1 -3 1 1 1 -3 10 0", "true"]]
  },
  {
    title: "Word Pattern", difficulty: "EASY", topic: "HashMap", subtopic: "Strings", style: "STRING_TWO",
    description: "Given a `pattern` and a string `s`, find if `s` follows the same pattern. Here follow means a full match, such that there is a bijection between a letter in `pattern` and a non-empty word in `s`.",
    sampleInput: "abba\ndog cat cat dog", sampleOutput: "true",
    tests: [["abba\ndog cat cat dog", "true"], ["abba\ndog cat cat fish", "false"], ["aaaa\ndog cat cat dog", "false"]]
  },
  {
    title: "Isomorphic Strings", difficulty: "EASY", topic: "HashMap", subtopic: "Strings", style: "STRING_TWO",
    description: "Given two strings `s` and `t`, determine if they are isomorphic. Two strings `s` and `t` are isomorphic if the characters in `s` can be replaced to get `t`.",
    sampleInput: "egg\nadd", sampleOutput: "true",
    tests: [["egg\nadd", "true"], ["foo\nbar", "false"], ["paper\ntitle", "true"]]
  },
  {
    title: "First Unique Character in a String", difficulty: "EASY", topic: "HashMap", subtopic: "Strings", style: "STRING",
    description: "Given a string `s`, find the first non-repeating character in it and return its index. If it does not exist, return `-1`.",
    sampleInput: "leetcode", sampleOutput: "0",
    tests: [["leetcode", "0"], ["loveleetcode", "2"], ["aabb", "-1"]]
  },
  {
    title: "Top K Frequent Elements", difficulty: "MEDIUM", topic: "HashMap", subtopic: "Heap", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. Print them space-separated, sorted in ascending order.",
    sampleInput: "6 2\n1 1 1 2 2 3", sampleOutput: "1 2",
    tests: [["6 2\n1 1 1 2 2 3", "1 2"], ["1 1\n1", "1"]]
  },
  {
    title: "Insert Delete GetRandom O(1)", difficulty: "MEDIUM", topic: "HashMap", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of operations).\nNext N lines: Operations 'insert X', 'remove X', or 'getRandom'.",
    outputFormat: "Prints 'true'/'false' for modifications, and the random element for 'getRandom'.",
    description: "Implement the RandomizedSet class such that insertion, deletion, and getRandom are all executed in average O(1) time complexity.",
    sampleInput: "7\ninsert 1\nremove 2\ninsert 2\ngetRandom\nremove 1\ninsert 2\ngetRandom", sampleOutput: "true\nfalse\ntrue\n2\ntrue\nfalse\n2",
    tests: [["7\ninsert 1\nremove 2\ninsert 2\ngetRandom\nremove 1\ninsert 2\ngetRandom", "true\nfalse\ntrue\n2\ntrue\nfalse\n2"]]
  },
  {
    title: "Longest Consecutive Sequence", difficulty: "MEDIUM", topic: "HashMap", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an unsorted array of integers `nums`, return the length of the longest consecutive elements sequence. Solve in O(N) time.",
    sampleInput: "6\n100 4 200 1 3 2", sampleOutput: "4",
    tests: [["6\n100 4 200 1 3 2", "4"], ["10\n0 3 7 2 5 8 4 6 0 1", "9"]]
  },
  {
    title: "Continuous Subarray Sum", difficulty: "MEDIUM", topic: "HashMap", subtopic: "Math", style: "ARRAY_INT_TARGET",
    description: "Given an integer array `nums` and an integer `k`, return `true` if `nums` has a good subarray of length at least two whose sum is a multiple of `k`.",
    sampleInput: "5 6\n23 2 4 6 7", sampleOutput: "true",
    tests: [["5 6\n23 2 4 6 7", "true"], ["5 6\n23 2 6 4 7", "true"], ["5 13\n23 2 4 6 7", "false"]]
  },
  {
    title: "Custom Sort String", difficulty: "MEDIUM", topic: "HashMap", subtopic: "Strings", style: "STRING_TWO",
    description: "You are given two strings `order` and `s`. All characters of `order` are unique. Permute the characters of `s` so they match the custom character ordering defined by `order`.",
    sampleInput: "cba\nabcd", sampleOutput: "cbad",
    tests: [["cba\nabcd", "cbad"], ["cbafg\nabcd", "cbad"]]
  },
  {
    title: "Max Points on a Line", difficulty: "HARD", topic: "HashMap", subtopic: "Math", style: "CUSTOM",
    inputFormat: "First line: N (number of points).\nNext N lines: two space-separated integers X Y representing coordinate coordinates.",
    outputFormat: "Max points aligned on a single straight line.",
    description: "Given an array of points where `points[i] = [xi, yi]` represents a point on the X-Y plane, return the maximum number of points that lie on the same straight line.",
    sampleInput: "3\n1 1\n2 2\n3 3", sampleOutput: "3",
    tests: [["3\n1 1\n2 2\n3 3", "3"], ["6\n1 1\n3 2\n5 3\n4 1\n2 3\n1 4", "4"]]
  },
  {
    title: "LFU Cache", difficulty: "HARD", topic: "HashMap", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: C (capacity) and N (queries).\nNext N lines: Command 'put K V' or 'get K'.",
    outputFormat: "Outputs of 'get K' commands.",
    description: "Design and implement a data structure for a Least Frequently Used (LFU) cache.",
    sampleInput: "2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3", sampleOutput: "1\n-1\n3",
    tests: [["2 6\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2\nget 3", "1\n-1\n3"]]
  },
  {
    title: "Substring with Concatenation of All Words", difficulty: "HARD", topic: "HashMap", subtopic: "Sliding Window", style: "CUSTOM",
    inputFormat: "First line: S (string).\nSecond line: N (number of words).\nNext N lines: A word.",
    outputFormat: "Space separated list of starting indices of matching substrings (sorted).",
    description: "You are given a string `s` and an array of strings `words` of the same length. Return all starting indices of substring(s) in `s` that is a concatenation of each word in `words` exactly once.",
    sampleInput: "barfoothefoobarman\n2\nfoo\nbar", sampleOutput: "0 9",
    tests: [["barfoothefoobarman\n2\nfoo\nbar", "0 9"], ["wordgoodgoodgoodbestword\n4\nword\ngood\nbest\nword", ""]]
  },
  {
    title: "All O`one Data Structure", difficulty: "HARD", topic: "HashMap", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of commands).\nNext N lines: Command 'inc Key', 'dec Key', 'getMax', 'getMin'.",
    outputFormat: "Prints string keys for 'getMax'/'getMin'.",
    description: "Design a data structure to store the strings' count with the ability to return the strings with minimum and maximum counts in O(1) time complexity.",
    sampleInput: "7\ninc hello\ninc hello\ninc world\ngetMax\ngetMin\ndec hello\ngetMin", sampleOutput: "hello\nworld\nhello",
    tests: [["7\ninc hello\ninc hello\ninc world\ngetMax\ngetMin\ndec hello\ngetMin", "hello\nworld\nhello"]]
  },

  // === STACK (14 new, 1 existing = 15 total) ===
  {
    title: "Min Stack", difficulty: "EASY", topic: "Stack", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of stack operations).\nNext N lines: Commands 'push X', 'pop', 'top', 'getMin'.",
    outputFormat: "Outputs of 'top' and 'getMin' commands.",
    description: "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.",
    sampleInput: "6\npush -2\npush 0\npush -3\ngetMin\npop\ntop\ngetMin", sampleOutput: "-3\n0\n-2",
    tests: [["6\npush -2\npush 0\npush -3\ngetMin\npop\ntop\ngetMin", "-3\n0\n-2"]]
  },
  {
    title: "Implement Queue using Stacks", difficulty: "EASY", topic: "Stack", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of operations).\nNext N lines: Commands 'push X', 'pop', 'peek', 'empty'.",
    outputFormat: "Outputs of 'pop', 'peek', and 'empty' commands.",
    description: "Implement a first in first out (FIFO) queue using only two stacks.",
    sampleInput: "5\npush 1\npush 2\npeek\npop\nempty", sampleOutput: "1\n1\nfalse",
    tests: [["5\npush 1\npush 2\npeek\npop\nempty", "1\n1\nfalse"]]
  },
  {
    title: "Remove All Adjacent Duplicates In String", difficulty: "EASY", topic: "Stack", subtopic: "Strings", style: "STRING",
    description: "You are given a string `s` consisting of lowercase English letters. A duplicate removal consists of choosing two adjacent and equal letters and removing them. Return the final string.",
    sampleInput: "abbaca", sampleOutput: "ca",
    tests: [["abbaca", "ca"], ["azxxzy", "ay"]]
  },
  {
    title: "Next Greater Element I", difficulty: "EASY", topic: "Stack", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: M (nums1 size) and N (nums2 size).\nSecond line: M integers.\nThird line: N integers.",
    outputFormat: "Space separated next greater elements.",
    description: "The next greater element of some element `x` in an array is the first greater element that is to the right of `x` in the same array. Find the next greater element in `nums2` for elements in `nums1`.",
    sampleInput: "3 4\n4 1 2\n1 3 4 2", sampleOutput: "-1 3 -1",
    tests: [["3 4\n4 1 2\n1 3 4 2", "-1 3 -1"], ["2 4\n2 4\n1 2 3 4", "3 -1"]]
  },
  {
    title: "Make The String Great", difficulty: "EASY", topic: "Stack", subtopic: "Strings", style: "STRING",
    description: "Given a string `s` of lower and upper case English letters. A good string is a string which doesn't have two adjacent characters `s[i]` and `s[i+1]` where they are same letter but different case. Make the string good.",
    sampleInput: "leEeetcode", sampleOutput: "leetcode",
    tests: [["leEeetcode", "leetcode"], ["abBAcC", ""], ["s", "s"]]
  },
  {
    title: "Simplify Path", difficulty: "MEDIUM", topic: "Stack", subtopic: "Strings", style: "STRING",
    description: "Given an absolute path for a Unix-style file system, simplify it to the canonical path.",
    sampleInput: "/home//foo/", sampleOutput: "/home/foo",
    tests: [["/home//foo/", "/home/foo"], ["/../", "/"], ["/a/./b/../../c/", "/c"]]
  },
  {
    title: "Evaluate Reverse Polish Notation", difficulty: "MEDIUM", topic: "Stack", subtopic: "Math", style: "CUSTOM",
    inputFormat: "First line: N (tokens size).\nSecond line: N space-separated tokens.",
    outputFormat: "Calculated value.",
    description: "Evaluate the value of an arithmetic expression in Reverse Polish Notation. Valid operators are `+`, `-`, `*`, and `/`.",
    sampleInput: "5\n2 1 + 3 *", sampleOutput: "9",
    tests: [["5\n2 1 + 3 *", "9"], ["5\n4 13 5 / +", "6"]]
  },
  {
    title: "Daily Temperatures", difficulty: "MEDIUM", topic: "Stack", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an array of integers `temperatures` representing the daily temperatures, return an array `answer` such that `answer[i]` is the number of days you have to wait after the `i`-th day to get a warmer temperature. If there is no future day, keep `0`.",
    sampleInput: "8\n73 74 75 71 69 72 76 73", sampleOutput: "1 1 4 2 1 1 0 0",
    tests: [["8\n73 74 75 71 69 72 76 73", "1 1 4 2 1 1 0 0"], ["4\n30 40 50 60", "1 1 1 0"]]
  },
  {
    title: "Generate Parentheses", difficulty: "MEDIUM", topic: "Stack", subtopic: "Recursion", style: "INT_SINGLE",
    description: "Given `n` pairs of parentheses, write a function to generate all combinations of well-formed parentheses. Output them sorted alphabetically on separate lines.",
    sampleInput: "3", sampleOutput: "((()))\n(()())\n(())()\n()(())\n()()()",
    tests: [["3", "((()))\n(()())\n(())()\n()(())\n()()()"], ["1", "()"]]
  },
  {
    title: "Asteroid Collision", difficulty: "MEDIUM", topic: "Stack", subtopic: "Arrays", style: "ARRAY_INT",
    description: "We are given an array `asteroids` of integers representing asteroids in a row. For each asteroid, the absolute value represents its size, and the sign represents its direction. Find the state of the asteroids after all collisions.",
    sampleInput: "3\n5 10 -5", sampleOutput: "5 10",
    tests: [["3\n5 10 -5", "5 10"], ["2\n8 -8", ""], ["3\n10 2 -5", "10"]]
  },
  {
    title: "Largest Rectangle in Histogram", difficulty: "HARD", topic: "Stack", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an array of integers `heights` representing the histogram's bar height where the width of each bar is `1`, return the area of the largest rectangle in the histogram.",
    sampleInput: "6\n2 1 5 6 2 3", sampleOutput: "10",
    tests: [["6\n2 1 5 6 2 3", "10"], ["2\n2 4", "4"]]
  },
  {
    title: "Basic Calculator", difficulty: "HARD", topic: "Stack", subtopic: "Math", style: "STRING",
    description: "Given a string `s` representing a valid expression, implement a basic calculator to evaluate it. Support `+`, `-`, `(`, and `)`.",
    sampleInput: "1 + 1", sampleOutput: "2",
    tests: [["1 + 1", "2"], ["(1+(4+5+2)-3)+(6+8)", "23"], ["-2+5", "3"]]
  },
  {
    title: "Remove Duplicate Letters", difficulty: "HARD", topic: "Stack", subtopic: "Greedy", style: "STRING",
    description: "Given a string `s`, remove duplicate letters so that every letter appears once and only once. You must make sure your result is the smallest in lexicographical order among all possible results.",
    sampleInput: "bcabc", sampleOutput: "abc",
    tests: [["bcabc", "abc"], ["cbacdcbc", "acdb"]]
  },
  {
    title: "Parsing A Boolean Expression", difficulty: "HARD", topic: "Stack", subtopic: "Recursion", style: "STRING",
    description: "Return the evaluation of a boolean expression representing character syntax: `t` (true), `f` (false), `!(expr)` (NOT), `&(expr1,expr2)` (AND), `|(expr1,expr2)` (OR).",
    sampleInput: "&(|(f,t),t)", sampleOutput: "true",
    tests: [["&(|(f,t),t)", "true"], ["|(f,f)", "false"], ["!(f)", "true"]]
  },

  // === QUEUE (15 problems) ===
  {
    title: "Implement Stack using Queues", difficulty: "EASY", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of operations).\nNext N lines: Commands 'push X', 'pop', 'top', 'empty'.",
    outputFormat: "Outputs of 'pop', 'top', and 'empty' commands.",
    description: "Implement a last-in-first-out (LIFO) stack using only two queues.",
    sampleInput: "5\npush 1\npush 2\ntop\npop\nempty", sampleOutput: "2\n2\nfalse",
    tests: [["5\npush 1\npush 2\ntop\npop\nempty", "2\n2\nfalse"]]
  },
  {
    title: "Number of Recent Calls", difficulty: "EASY", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (number of ping requests).\nNext N lines: Integers representing ping timestamps in milliseconds.",
    outputFormat: "Outputs of each ping request representing the number of recent requests within 3000ms.",
    description: "You have a RecentCounter class which counts the number of recent requests within a certain time frame.",
    sampleInput: "4\n1\n100\n3001\n3002", sampleOutput: "1\n2\n3\n3",
    tests: [["4\n1\n100\n3001\n3002", "1\n2\n3\n3"]]
  },
  {
    title: "Moving Average from Data Stream", difficulty: "EASY", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: S (window size) and N (stream additions count).\nNext N lines: Integers added to the stream.",
    outputFormat: "Moving average outputs of each addition.",
    description: "Given a stream of integers and a window size, calculate the moving average of all integers in the sliding window.",
    sampleInput: "3 3\n1\n10\n3", sampleOutput: "1.00000\n5.50000\n4.66667",
    tests: [["3 3\n1\n10\n3", "1.00000\n5.50000\n4.66667"]]
  },
  {
    title: "Design Circular Queue", difficulty: "EASY", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: K (queue capacity) and N (number of operations).\nNext N lines: Commands 'enQueue X', 'deQueue', 'Front', 'Rear', 'isEmpty', 'isFull'.",
    outputFormat: "Outputs of each command ('true'/'false' or the elements).",
    description: "Design your implementation of the circular queue. The circular queue is a linear data structure in which the operations are performed based on FIFO principle and the last position is connected back to the first position.",
    sampleInput: "3 8\nenQueue 1\nenQueue 2\nenQueue 3\nenQueue 4\nRear\nisFull\ndeQueue\nenQueue 4\nRear", sampleOutput: "true\ntrue\ntrue\nfalse\n3\ntrue\ntrue\ntrue\n4",
    tests: [["3 8\nenQueue 1\nenQueue 2\nenQueue 3\nenQueue 4\nRear\nisFull\ndeQueue\nenQueue 4\nRear", "true\ntrue\ntrue\nfalse\n3\ntrue\ntrue\ntrue\n4"]]
  },
  {
    title: "Design Circular Deque", difficulty: "MEDIUM", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: K (capacity) and N (operations count).\nNext N lines: Deque commands.",
    outputFormat: "Outputs of commands.",
    description: "Design your implementation of the circular double-ended queue (deque).",
    sampleInput: "3 6\ninsertLast 1\ninsertLast 2\ninsertFront 3\ngetRear\nisFull\ngetFront", sampleOutput: "true\ntrue\ntrue\n2\ntrue\n3",
    tests: [["3 6\ninsertLast 1\ninsertLast 2\ninsertFront 3\ngetRear\nisFull\ngetFront", "true\ntrue\ntrue\n2\ntrue\n3"]]
  },
  {
    title: "Task Scheduler", difficulty: "MEDIUM", topic: "Queue", subtopic: "Greedy, HashMap", style: "CUSTOM",
    inputFormat: "First line: N (number of tasks) and C (cooldown intervals count).\nSecond line: N space-separated characters representing tasks.",
    outputFormat: "Minimum CPU intervals needed.",
    description: "Given a characters array `tasks`, representing the tasks a CPU needs to do, and cooldown interval `n`, return the minimum number of intervals required to complete all tasks.",
    sampleInput: "6 2\nA A A B B B", sampleOutput: "8",
    tests: [["6 2\nA A A B B B", "8"], ["6 0\nA A A B B B", "6"]]
  },
  {
    title: "Product of the Last K Numbers", difficulty: "MEDIUM", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (operations count).\nNext N lines: Command 'add X' or 'getProduct K'.",
    outputFormat: "Product outputs for 'getProduct' queries.",
    description: "Design an algorithm that accepts a stream of integers and retrieves the product of the last `k` numbers in constant time.",
    sampleInput: "7\nadd 3\nadd 0\nadd 2\nadd 5\nadd 4\ngetProduct 2\ngetProduct 3", sampleOutput: "20\n40",
    tests: [["7\nadd 3\nadd 0\nadd 2\nadd 5\nadd 4\ngetProduct 2\ngetProduct 3", "20\n40"]]
  },
  {
    title: "Design Front Middle Back Queue", difficulty: "MEDIUM", topic: "Queue", subtopic: "Design", style: "CUSTOM",
    inputFormat: "First line: N (operations count).\nNext N lines: Commands 'pushFront X', 'pushMiddle X', 'pushBack X', 'popFront', 'popMiddle', 'popBack'.",
    outputFormat: "Outputs of pop commands.",
    description: "Design a queue that supports push and pop operations in the front, middle, and back.",
    sampleInput: "8\npushFront 1\npushBack 2\npushMiddle 3\npopFront\npopMiddle\npopBack\npopFront\nempty", sampleOutput: "1\n3\n2\n-1",
    tests: [["8\npushFront 1\npushBack 2\npushMiddle 3\npopFront\npopMiddle\npopBack\npopFront\nempty", "1\n3\n2\n-1"]]
  },
  {
    title: "Dota2 Senate", difficulty: "MEDIUM", topic: "Queue", subtopic: "Strings", style: "STRING",
    description: "Predict which party ('Radiant' or 'Dire') will win the senate voting round given the political order representing senators.",
    sampleInput: "RD", sampleOutput: "Radiant",
    tests: [["RD", "Radiant"], ["RDD", "Dire"]]
  },
  {
    title: "Jump Game VI", difficulty: "HARD", topic: "Queue", subtopic: "Dynamic Programming", style: "ARRAY_INT_TARGET",
    description: "You are given a 0-indexed integer array `nums` and an integer `k`. You are initially standing at index `0`. Return the maximum score you can get to reach the last index. You can jump at most `k` steps forward.",
    sampleInput: "5 2\n1 -1 -2 4 -7", sampleOutput: "7",
    tests: [["5 2\n1 -1 -2 4 -7", "7"], ["6 3\n10 -5 -2 4 0 3", "17"]]
  },
  {
    title: "Minimum Cost to Hire K Workers", difficulty: "HARD", topic: "Queue", subtopic: "Greedy, Heap", style: "CUSTOM",
    inputFormat: "First line: N (workers) and K (hiring count).\nSecond line: N integers (quality).\nThird line: N integers (wage expectation).",
    outputFormat: "Minimum cost as float.",
    description: "There are `n` workers. Given their quality and expected wages, we want to hire exactly `k` workers. Find the minimum cost to hire them according to standard ratio rules.",
    sampleInput: "3 2\n10 20 5\n70 50 30", sampleOutput: "105.00000",
    tests: [["3 2\n10 20 5\n70 50 30", "105.00000"], ["4 3\n3 1 10 10\n4 8 2 27", "30.66667"]]
  },
  {
    title: "Max Value of Equation", difficulty: "HARD", topic: "Queue", subtopic: "Sliding Window", style: "CUSTOM",
    inputFormat: "First line: N (points count) and K (limit on absolute x difference).\nNext N lines: coordinates pairs X Y representing points.",
    outputFormat: "Maximum value of equation (yi + yj + |xi - xj|).",
    description: "You are given an array `points` containing the coordinates of points on a 2D plane, sorted by x-values, and an integer `k`. Find the maximum value of the equation.",
    sampleInput: "4 1\n1 3\n2 0\n5 10\n6 -10", sampleOutput: "4",
    tests: [["4 1\n1 3\n2 0\n5 10\n6 -10", "4"], ["3 3\n0 0\n3 0\n4 10", "13"]]
  },
  {
    title: "Stamping The Sequence", difficulty: "HARD", topic: "Queue", subtopic: "Greedy", style: "STRING_TWO",
    description: "Given a string `stamp` and target `target`, return an array of the index sequences to replace character sequences by stamp to build target. If impossible, return empty string.",
    sampleInput: "abc\nababc", sampleOutput: "0 2",
    tests: [["abc\nababc", "0 2"], ["abca\naabcaca", "3 0 1"]]
  },

  // === DP (14 new, 1 existing = 15 total) ===
  {
    title: "Climbing Stairs", difficulty: "EASY", topic: "Dynamic Programming", subtopic: "Math", style: "INT_SINGLE",
    description: "You are climbing a staircase. It takes `n` steps to reach the top. Each time you can either climb `1` or `2` steps. In how many distinct ways can you climb to the top?",
    sampleInput: "3", sampleOutput: "3",
    tests: [["3", "3"], ["2", "2"], ["10", "89"]]
  },
  {
    title: "Min Cost Climbing Stairs", difficulty: "EASY", topic: "Dynamic Programming", subtopic: "Arrays", style: "ARRAY_INT",
    description: "You are given an integer array `cost` where `cost[i]` is the cost of `i`-th step on a staircase. Once you pay the cost, you can climb one or two steps. Find the minimum cost to reach the top.",
    sampleInput: "3\n10 15 20", sampleOutput: "15",
    tests: [["3\n10 15 20", "15"], ["10\n1 100 1 1 1 100 1 1 100 1", "6"]]
  },
  {
    title: "Divisor Game", difficulty: "EASY", topic: "Dynamic Programming", subtopic: "Math", style: "INT_SINGLE",
    description: "Alice and Bob take turns playing a game, with Alice starting. Initially, there is a number `n` on the chalkboard. On each turn, a player chooses `x` where `0 < x < n` and `n % x == 0`, and replaces `n` with `n - x`. Return `true` if Alice wins.",
    sampleInput: "2", sampleOutput: "true",
    tests: [["2", "true"], ["3", "false"]]
  },
  {
    title: "Counting Bits", difficulty: "EASY", topic: "Dynamic Programming", subtopic: "Bit Manipulation", style: "INT_SINGLE",
    description: "Given an integer `n`, return an array of length `n + 1` such that for each `i` (`0 <= i <= n`), `ans[i]` is the number of `1`s in the binary representation of `i`. Print elements space-separated.",
    sampleInput: "2", sampleOutput: "0 1 1",
    tests: [["2", "0 1 1"], ["5", "0 1 1 2 1 2"]]
  },
  {
    title: "N-th Tribonacci Number", difficulty: "EASY", topic: "Dynamic Programming", subtopic: "Recursion", style: "INT_SINGLE",
    description: "The Tribonacci sequence T_n is defined as: T_0 = 0, T_1 = 1, T_2 = 1, and T_n = T_{n-1} + T_{n-2} + T_{n-3} for n >= 3. Return the value of T_n.",
    sampleInput: "4", sampleOutput: "4",
    tests: [["4", "4"], ["25", "1389537"]]
  },
  {
    title: "Coin Change", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "You are given an integer array `coins` representing coins of different denominations and an integer `amount` representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If impossible, return `-1`.",
    sampleInput: "3 11\n1 2 5", sampleOutput: "3",
    tests: [["3 11\n1 2 5", "3"], ["1 3\n2", "-1"], ["1 0\n1", "0"]]
  },
  {
    title: "Longest Common Subsequence", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Strings", style: "STRING_TWO",
    description: "Given two strings `text1` and `text2`, return the length of their longest common subsequence. If there is no common subsequence, return `0`.",
    sampleInput: "abcde\nace", sampleOutput: "3",
    tests: [["abcde\nace", "3"], ["abc\nabc", "3"], ["abc\ndef", "0"]]
  },
  {
    title: "House Robber", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Arrays", style: "ARRAY_INT",
    description: "You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed. Return the maximum amount of money you can rob tonight without alerting the police (cannot rob adjacent houses).",
    sampleInput: "4\n1 2 3 1", sampleOutput: "4",
    tests: [["4\n1 2 3 1", "4"], ["5\n2 7 9 3 1", "12"]]
  },
  {
    title: "Unique Paths", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Combinatorics", style: "CUSTOM",
    inputFormat: "A single line containing two space-separated integers M (rows) and N (cols).",
    outputFormat: "Number of unique paths from top-left to bottom-right.",
    description: "There is a robot on an `m x n` grid. The robot is initially located at the top-left corner. The robot tries to move to the bottom-right corner. The robot can only move either down or right at any point.",
    sampleInput: "3 7", sampleOutput: "28",
    tests: [["3 7", "28"], ["3 2", "3"], ["3 3", "6"]]
  },
  {
    title: "Uncrossed Lines", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: N (nums1 size) and M (nums2 size).\nSecond line: N integers (nums1).\nThird line: M integers (nums2).",
    outputFormat: "Maximum number of uncrossed lines.",
    description: "You are given two integer arrays `nums1` and `nums2`. We write the integers of `nums1` and `nums2` (in the order they are given) on two separate horizontal lines. Return the maximum number of uncrossed connecting straight lines.",
    sampleInput: "3 3\n1 4 2\n1 2 4", sampleOutput: "2",
    tests: [["3 3\n1 4 2\n1 2 4", "2"], ["5 6\n2 5 1 2 5\n10 5 2 1 5 2", "3"], ["6 5\n1 3 7 1 7 5\n1 9 2 5 1", "2"]]
  },
  {
    title: "Longest Valid Parentheses", difficulty: "HARD", topic: "Dynamic Programming", subtopic: "Stack", style: "STRING",
    description: "Given a string containing just the characters `'('` and `')'`, return the length of the longest valid (well-formed) parentheses substring.",
    sampleInput: "(()", sampleOutput: "2",
    tests: [["(()", "2"], [")()())", "4"], ["", "0"]]
  },
  {
    title: "Super Egg Drop", difficulty: "HARD", topic: "Dynamic Programming", subtopic: "Math", style: "CUSTOM",
    inputFormat: "A single line containing two space-separated integers K (eggs) and N (floors).",
    outputFormat: "Minimum number of moves to find critical floor.",
    description: "You are given `k` identical eggs and you have access to a building with `n` floors labeled from `1` to `n`. Return the minimum number of moves that you need to determine with certainty what the value of the critical floor is.",
    sampleInput: "1 2", sampleOutput: "2",
    tests: [["1 2", "2"], ["2 6", "3"], ["3 14", "4"]]
  },
  {
    title: "Cherry Pickup", difficulty: "HARD", topic: "Dynamic Programming", subtopic: "Matrix", style: "CUSTOM",
    inputFormat: "First line: N (grid size).\nNext N lines: N integers representing grid status (0: empty, 1: cherry, -1: wall).",
    outputFormat: "Maximum cherries collected.",
    description: "You are given an `n x n` grid representing a field of cherries. You start at `(0, 0)` and must move to `(n-1, n-1)`, collect cherries, then return back. Return the maximum cherries you can collect.",
    sampleInput: "3\n0 1 -1\n1 0 -1\n1 1 1", sampleOutput: "5",
    tests: [["3\n0 1 -1\n1 0 -1\n1 1 1", "5"], ["2\n1 1\n-1 1", "0"]]
  },
  {
    title: "Maximal Square", difficulty: "MEDIUM", topic: "Dynamic Programming", subtopic: "Matrix", style: "CUSTOM",
    inputFormat: "First line: M (rows) and N (cols).\nNext M lines: N space-separated characters representing grid.",
    outputFormat: "Area of the largest square of 1s.",
    description: "Given an `m x n` binary matrix filled with `0`'s and `1`'s, find the largest square containing only `1`'s and return its area.",
    sampleInput: "4 5\n1 0 1 0 0\n1 0 1 1 1\n1 1 1 1 1\n1 0 0 1 0", sampleOutput: "4",
    tests: [["4 5\n1 0 1 0 0\n1 0 1 1 1\n1 1 1 1 1\n1 0 0 1 0", "4"], ["2 2\n0 0\n0 0", "0"]]
  },

  // === GREEDY (15 problems) ===
  {
    title: "Assign Cookies", difficulty: "EASY", topic: "Greedy", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: G (children size) and S (cookies size).\nSecond line: G integers (greed values).\nThird line: S integers (cookies sizes).",
    outputFormat: "Number of content children.",
    description: "Assume you are an awesome parent and want to give your children some cookies. But, you should give each child at most one cookie. Assign cookies to satisfy maximum children.",
    sampleInput: "3 2\n1 2 3\n1 1", sampleOutput: "1",
    tests: [["3 2\n1 2 3\n1 1", "1"], ["2 3\n1 2\n1 3 4", "2"]]
  },
  {
    title: "Lemonade Change", difficulty: "EASY", topic: "Greedy", subtopic: "Arrays", style: "ARRAY_INT",
    description: "At a lemonade stand, each lemonade costs $5. Customers stand in a queue to buy from you and order one at a time. Each customer pays with a $5, $10, or $20 bill. Return `true` if you can provide change.",
    sampleInput: "5\n5 5 5 10 20", sampleOutput: "true",
    tests: [["5\n5 5 5 10 20", "true"], ["5\n5 5 10 10 20", "false"]]
  },
  {
    title: "Best Time to Buy and Sell Stock II", difficulty: "EASY", topic: "Greedy", subtopic: "Arrays", style: "ARRAY_INT",
    description: "You are given an integer array `prices` where `prices[i]` is the price of a given stock on the `i`-th day. Find the maximum profit you can achieve by making multiple transactions.",
    sampleInput: "6\n7 1 5 3 6 4", sampleOutput: "7",
    tests: [["6\n7 1 5 3 6 4", "7"], ["5\n1 2 3 4 5", "4"], ["5\n7 6 4 3 1", "0"]]
  },
  {
    title: "Can Place Flowers", difficulty: "EASY", topic: "Greedy", subtopic: "Arrays", style: "ARRAY_INT_TARGET",
    description: "You have a long flowerbed in which some of the plots are planted, and some are not. Given an integer array `flowerbed` and `n`, return `true` if `n` new flowers can be planted without violating no-adjacent rule.",
    sampleInput: "5 1\n1 0 0 0 1", sampleOutput: "true",
    tests: [["5 1\n1 0 0 0 1", "true"], ["5 2\n1 0 0 0 1", "false"]]
  },
  {
    title: "Minimum Subsequence in Non-Increasing Order", difficulty: "EASY", topic: "Greedy", subtopic: "Sorting", style: "ARRAY_INT",
    description: "Given the array `nums`, obtain a subsequence of the array whose sum of elements is strictly greater than the sum of the non-included elements in such subsequence. Print it sorted descending.",
    sampleInput: "4\n4 3 10 9", sampleOutput: "10 9",
    tests: [["4\n4 3 10 9", "10 9"], ["5\n4 4 7 6 7", "7 7 6"]]
  },
  {
    title: "Jump Game", difficulty: "MEDIUM", topic: "Greedy", subtopic: "Dynamic Programming", style: "ARRAY_INT",
    description: "You are given an integer array `nums`. You are initially positioned at the array's first index, and each element represents your maximum jump length at that position. Return `true` if you can reach the last index.",
    sampleInput: "5\n2 3 1 1 4", sampleOutput: "true",
    tests: [["5\n2 3 1 1 4", "true"], ["5\n3 2 1 0 4", "false"]]
  },
  {
    title: "Gas Station", difficulty: "MEDIUM", topic: "Greedy", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: N (gas stations count).\nSecond line: N integers (gas amount).\nThird line: N integers (cost to next station).",
    outputFormat: "Starting gas station index (or -1).",
    description: "There are `n` gas stations along a circular route. Given gas and cost arrays, return the starting gas station's index if you can travel around the circuit once in the clockwise direction.",
    sampleInput: "5\n1 2 3 4 5\n3 4 5 1 2", sampleOutput: "3",
    tests: [["5\n1 2 3 4 5\n3 4 5 1 2", "3"], ["3\n2 3 4\n3 4 3", "-1"]]
  },
  {
    title: "Partition Labels", difficulty: "MEDIUM", topic: "Greedy", subtopic: "Strings", style: "STRING",
    description: "You are given a string `s`. We want to partition the string into as many parts as possible so that each letter appears in at most one part. Return list of partition sizes.",
    sampleInput: "ababcbacadefegdehijhklij", sampleOutput: "9 7 8",
    tests: [["ababcbacadefegdehijhklij", "9 7 8"], ["eccbbbbdec", "10"]]
  },
  {
    title: "Non-overlapping Intervals", difficulty: "MEDIUM", topic: "Greedy", subtopic: "Sorting", style: "CUSTOM",
    inputFormat: "First line: N (intervals count).\nNext N lines: start and end bounds of each interval.",
    outputFormat: "Minimum intervals to remove.",
    description: "Given an array of intervals `intervals`, return the minimum number of intervals you need to remove to make the rest of the intervals non-overlapping.",
    sampleInput: "4\n1 2\n2 3\n3 4\n1 3", sampleOutput: "1",
    tests: [["4\n1 2\n2 3\n3 4\n1 3", "1"], ["3\n1 2\n1 2\n1 2", "2"], ["3\n1 2\n2 3\n3 4", "0"]]
  },
  {
    title: "Candy", difficulty: "HARD", topic: "Greedy", subtopic: "Arrays", style: "ARRAY_INT",
    description: "There are `n` children standing in a line. Each child is assigned a rating value. Give candies to these children subjected to rating rules such that the total candies is minimized.",
    sampleInput: "3\n1 0 2", sampleOutput: "5",
    tests: [["3\n1 0 2", "5"], ["3\n1 2 2", "4"]]
  },
  {
    title: "Course Schedule III", difficulty: "HARD", topic: "Greedy", subtopic: "Heap", style: "CUSTOM",
    inputFormat: "First line: N (courses count).\nNext N lines: duration and lastDay limit.",
    outputFormat: "Max courses that can be taken.",
    description: "There are `n` courses. Find the maximum number of courses you can take given their duration and deadline constraints.",
    sampleInput: "4\n100 200\n200 1300\n1000 1250\n2000 3200", sampleOutput: "3",
    tests: [["4\n100 200\n200 1300\n1000 1250\n2000 3200", "3"], ["2\n1 2\n3 2", "1"]]
  },
  {
    title: "Patching Array", difficulty: "HARD", topic: "Greedy", subtopic: "Arrays", style: "CUSTOM",
    inputFormat: "First line: N (nums size) and N_max (target limit).\nSecond line: N space-separated elements.",
    outputFormat: "Minimum patches added.",
    description: "Given a sorted integer array `nums` and an integer `n`, add/patch elements to the array such that any number in range `[1, n]` can be formed by sum of elements. Return minimum patches.",
    sampleInput: "3 6\n1 3", sampleOutput: "1",
    tests: [["2 6\n1 3", "1"], ["3 5\n1 5 10", "1"]]
  },
  {
    title: "IPO", difficulty: "HARD", topic: "Greedy", subtopic: "Heap", style: "CUSTOM",
    inputFormat: "First line: K (projects count limit), W (initial capital), N (available projects).\nSecond line: N integers representing profits.\nThird line: N integers representing capital requirements.",
    outputFormat: "Final maximized capital.",
    description: "Find the maximized capital after selecting at most `k` distinct projects from `n` projects under capital constraints.",
    sampleInput: "2 0 3\n1 2 3\n0 1 1", sampleOutput: "4",
    tests: [["2 0 3\n1 2 3\n0 1 1", "4"], ["3 0 3\n1 2 3\n0 1 2", "6"]]
  },
  {
    title: "Reducing Dishes", difficulty: "HARD", topic: "Greedy", subtopic: "Sorting", style: "ARRAY_INT",
    description: "A chef has collected data on the satisfaction level of his `n` dishes. Return the maximum sum of Like-time coefficient.",
    sampleInput: "5\n-1 -8 0 5 -9", sampleOutput: "14",
    tests: [["5\n-1 -8 0 5 -9", "14"], ["3\n4 3 2", "20"]]
  },

  // === BIT MANIPULATION (15 problems) ===
  {
    title: "Single Number", difficulty: "EASY", topic: "Bit Manipulation", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given a non-empty array of integers `nums`, every element appears twice except for one. Find that single one.",
    sampleInput: "3\n2 2 1", sampleOutput: "1",
    tests: [["3\n2 2 1", "1"], ["5\n4 1 2 1 2", "4"], ["1\n1", "1"]]
  },
  {
    title: "Number of 1 Bits", difficulty: "EASY", topic: "Bit Manipulation", subtopic: "Math", style: "INT_SINGLE",
    description: "Write a function that takes an unsigned integer and returns the number of '1' bits it has (also known as the Hamming weight).",
    sampleInput: "11", sampleOutput: "3",
    tests: [["11", "3"], ["128", "1"], ["0", "0"]]
  },
  {
    title: "Reverse Bits", difficulty: "EASY", topic: "Bit Manipulation", subtopic: "Math", style: "INT_SINGLE",
    description: "Reverse bits of a given 32-bit unsigned integer.",
    sampleInput: "43261596", sampleOutput: "964176192",
    tests: [["43261596", "964176192"], ["0", "0"]]
  },
  {
    title: "Power of Two", difficulty: "EASY", topic: "Bit Manipulation", subtopic: "Math", style: "INT_SINGLE",
    description: "Given an integer `n`, return `true` if it is a power of two. Otherwise, return `false`.",
    sampleInput: "16", sampleOutput: "true",
    tests: [["16", "true"], ["3", "false"], ["1", "true"]]
  },
  {
    title: "Missing Number", difficulty: "EASY", topic: "Bit Manipulation", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an array `nums` containing `n` distinct numbers in the range `[0, n]`, return the only number in the range that is missing from the array.",
    sampleInput: "3\n3 0 1", sampleOutput: "2",
    tests: [["3\n3 0 1", "2"], ["2\n0 1", "2"], ["9\n9 6 4 2 3 5 7 0 1", "8"]]
  },
  {
    title: "Single Number II", difficulty: "MEDIUM", topic: "Bit Manipulation", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an integer array `nums` where every element appears three times except for one, which appears exactly once. Find the single element.",
    sampleInput: "4\n2 2 3 2", sampleOutput: "3",
    tests: [["4\n2 2 3 2", "3"], ["7\n0 1 0 1 0 1 99", "99"]]
  },
  {
    title: "Single Number III", difficulty: "MEDIUM", topic: "Bit Manipulation", subtopic: "Arrays", style: "ARRAY_INT",
    description: "Given an integer array `nums`, in which exactly two elements appear only once and all the other elements appear exactly twice. Find the two elements that appear only once. Print space separated, sorted.",
    sampleInput: "6\n1 2 1 3 2 5", sampleOutput: "3 5",
    tests: [["6\n1 2 1 3 2 5", "3 5"], ["2\n-1 0", "-1 0"]]
  },
  {
    title: "Bitwise AND of Numbers Range", difficulty: "MEDIUM", topic: "Bit Manipulation", subtopic: "Math", style: "CUSTOM",
    inputFormat: "A single line containing two space-separated integers LEFT and RIGHT.",
    outputFormat: "Bitwise AND of all numbers in the inclusive range.",
    description: "Given two integers `left` and `right` that represent the range `[left, right]`, return the bitwise AND of all numbers in this range, inclusive.",
    sampleInput: "5 7", sampleOutput: "4",
    tests: [["5 7", "4"], ["0 0", "0"], ["1 2147483647", "0"]]
  },
  {
    title: "Subsets", difficulty: "MEDIUM", topic: "Bit Manipulation", subtopic: "Recursion", style: "ARRAY_INT",
    description: "Given an integer array `nums` of unique elements, return all possible subsets (the power set). Output each subset sorted, space-separated, and the entire set of subsets sorted alphabetically.",
    sampleInput: "3\n1 2 3", sampleOutput: "\n1\n1 2\n1 2 3\n1 3\n2\n2 3\n3",
    tests: [["3\n1 2 3", "\n1\n1 2\n1 2 3\n1 3\n2\n2 3\n3"], ["1\n0", "\n0"]]
  },
  {
    title: "Maximum Product of Word Lengths", difficulty: "MEDIUM", topic: "Bit Manipulation", subtopic: "Strings", style: "CUSTOM",
    inputFormat: "First line: N (number of words).\nSecond line: N space-separated words.",
    outputFormat: "Maximum product of length of two words with no common letters.",
    description: "Given a string array `words`, return the maximum value of `length(word[i]) * length(word[j])` where the two words do not share common letters.",
    sampleInput: "6\nabw foo bar xtfn abcdef", sampleOutput: "16",
    tests: [["6\nabcde fghij klmno pqrst uvwxy z", "25"], ["6\naba foo bar xtfn abcdef", "16"]]
  },
  {
    title: "Maximum XOR of Two Numbers in an Array", difficulty: "HARD", topic: "Bit Manipulation", subtopic: "Trie", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return the maximum result of `nums[i] XOR nums[j]`, where `0 <= i <= j < n`.",
    sampleInput: "6\n3 10 5 25 2 8", sampleOutput: "28",
    tests: [["6\n3 10 5 25 2 8", "28"], ["8\n14 70 53 83 49 91 36 80", "127"]]
  },
  {
    title: "Minimum One Bit Operations to Make Integers Zero", difficulty: "HARD", topic: "Bit Manipulation", subtopic: "Math", style: "INT_SINGLE",
    description: "Given an integer `n`, you must transform it into `0` using specific bitwise operations. Return the minimum operations.",
    sampleInput: "3", sampleOutput: "2",
    tests: [["3", "2"], ["6", "4"]]
  },
  {
    title: "Triples with Bitwise AND Equal To Zero", difficulty: "HARD", topic: "Bit Manipulation", subtopic: "HashMap", style: "ARRAY_INT",
    description: "Given an integer array `nums`, return the number of AND triples `(i, j, k)` such that `nums[i] & nums[j] & nums[k] == 0`.",
    sampleInput: "3\n2 1 3", sampleOutput: "12",
    tests: [["3\n2 1 3", "12"], ["2\n0 0", "8"]]
  },
  {
    title: "Maximum XOR With an Element From Array", difficulty: "HARD", topic: "Bit Manipulation", subtopic: "Trie", style: "CUSTOM",
    inputFormat: "First line: N (array size) and Q (queries size).\nSecond line: N space-separated integers.\nNext Q lines: X and M limit.",
    outputFormat: "Max XOR result for each query, or -1 if no element is <= M.",
    description: "Given an array and queries of form `[Xi, Mi]`, find the maximum XOR value of `Xi` with any element in array that is less than or equal to `Mi`.",
    sampleInput: "5 3\n0 1 2 3 4\n3 1\n1 3\n5 6", sampleOutput: "3\n3\n7",
    tests: [["5 3\n0 1 2 3 4\n3 1\n1 3\n5 6", "3\n3\n7"], ["5 2\n5 2 4 6 6\n12 4\n1 1", "15\n-1"]]
  },
  {
    title: "Find Longest Awesome Substring", difficulty: "HARD", topic: "Bit Manipulation", subtopic: "Strings", style: "STRING",
    description: "Given a string `s` of digits, return the length of the longest awesome non-empty substring of `s`. Awesome substring is one that can be permuted to form a palindrome.",
    sampleInput: "3242415", sampleOutput: "5",
    tests: [["3242415", "5"], ["12345678", "1"], ["213123", "6"]]
  }
];

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing problems to prevent duplicate keys
  console.log("🗑️ Clearing existing problems...");
  await prisma.problem.deleteMany();

  // 2. Seed existing problems
  console.log("📝 Seeding existing 5 problems...");
  for (const prob of existingProblems) {
    const { testCases, ...problemFields } = prob;
    console.log(`   └─ ${prob.title}`);
    await prisma.problem.create({
      data: {
        ...problemFields,
        testCases: {
          create: testCases,
        },
      },
    });
  }

  // 3. Seed new expanded problems
  console.log("📝 Expanding and seeding 155 new problems...");
  for (const compact of compactProblems) {
    const expanded = expandProblem(compact);
    const { testCases, ...problemFields } = expanded;
    console.log(`   └─ ${expanded.title} (${expanded.topic})`);
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
