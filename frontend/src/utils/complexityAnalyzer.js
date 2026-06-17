/**
 * Static Code Complexity Analyzer
 * Evaluates loop nesting, division structures, sorting logic, recursion,
 * and memory allocation structures to estimate algorithmic complexities.
 */
export const analyzeComplexity = (code, language) => {
  if (!code) return { time: "O(1)", space: "O(1)" };

  // Remove single line and multi-line comments
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  const lowerCode = cleanCode.toLowerCase();
  let timeComplexity = "O(1)";
  let maxLoopNesting = 0;

  // Track loop nesting based on language syntax rules
  if (language === "python") {
    const lines = cleanCode.split("\n");
    const loopIndents = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const isLoop = trimmed.startsWith("for ") || trimmed.startsWith("while ");
      const indent = line.length - line.trimStart().length;
      
      while (loopIndents.length > 0 && loopIndents[loopIndents.length - 1] >= indent) {
        loopIndents.pop();
      }
      
      if (isLoop) {
        loopIndents.push(indent);
        maxLoopNesting = Math.max(maxLoopNesting, loopIndents.length);
      }
    }
  } else {
    // Curly-brace languages: JS, C++, Java, C
    const lines = cleanCode.split("\n");
    const activeLoops = []; // stack of { braceDepth }
    let braceDepth = 0;
    
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === "{") {
          braceDepth++;
        } else if (char === "}") {
          braceDepth--;
          while (activeLoops.length > 0 && activeLoops[activeLoops.length - 1].braceDepth > braceDepth) {
            activeLoops.pop();
          }
        }
      }
      
      const trimmed = line.trim();
      const isLoop = /\b(for|while)\b\s*\(/.test(trimmed);
      if (isLoop) {
        activeLoops.push({ braceDepth });
        maxLoopNesting = Math.max(maxLoopNesting, activeLoops.length);
      }
    }
  }

  // Determine Time Complexity
  if (maxLoopNesting >= 3) {
    timeComplexity = "O(N³)";
  } else if (maxLoopNesting === 2) {
    timeComplexity = "O(N²)";
  } else if (maxLoopNesting === 1) {
    // Check if it's logarithmic (e.g., divide-by-2, shift-by-1, binary search)
    const hasLogScaling = /\b(mid|binary|search|low|high)\b/i.test(lowerCode) && 
                         (/\/=\s*2|>>\s*1|\/\s*2|math\.floor/i.test(lowerCode) || lowerCode.includes("mid ="));
    if (hasLogScaling) {
      timeComplexity = "O(log N)";
    } else {
      timeComplexity = "O(N)";
    }
  } else {
    // Check for recursion
    const isRecursive = detectRecursion(cleanCode, language);
    if (isRecursive) {
      if (cleanCode.split("fib(").length > 2 || cleanCode.split("solve(").length > 3) {
        timeComplexity = "O(2^N)";
      } else {
        timeComplexity = "O(N)";
      }
    } else {
      timeComplexity = "O(1)";
    }
  }

  // Adjust for sorting (which takes O(N log N))
  const hasSort = /\.sort\b/i.test(cleanCode) || /\bsort\(/i.test(cleanCode);
  if (hasSort) {
    if (timeComplexity === "O(N)" || timeComplexity === "O(1)") {
      timeComplexity = "O(N log N)";
    }
  }

  // --- SPACE COMPLEXITY ANALYSIS ---
  let spaceComplexity = "O(1)";

  // Check for 2D Arrays / Matrices -> O(N²)
  if (/\bvector\s*<\s*vector/i.test(cleanCode) ||
      /\[\s*\]\s*\[\s*\]/.test(cleanCode) ||
      /new\s+int\s*\[\s*\w+\s*\]\s*\[\s*\w+\s*\]/i.test(cleanCode) ||
      /\[\s*\[\s*\]\s*\]/.test(cleanCode) ||
      /\[\s*\[.*\]\s*\]/.test(cleanCode)) {
    spaceComplexity = "O(N²)";
  }
  // Check for Linear Data Structures (Maps, Sets, Arrays, Vectors, Lists) -> O(N)
  else if (/\bmap\b|\bset\b|\bdict\b|\bhashmap\b|\bunordered_map\b|\bunordered_set\b/i.test(lowerCode) ||
           /new\s+(map|set|hashmap|treemap|hashset|arraylist|vector|list)/i.test(lowerCode) ||
           /\bvector\b|\blist\b|\barray\b|\bnew\s+int\s*\[/i.test(lowerCode) ||
           /\[\s*\]\s*=\s*new/i.test(lowerCode) ||
           /malloc|calloc/i.test(lowerCode) ||
           (/\[\s*\]/.test(cleanCode) && cleanCode.includes("push("))) {
    spaceComplexity = "O(N)";
  }
  // Check for stack space in recursion
  else if (detectRecursion(cleanCode, language)) {
    spaceComplexity = "O(N)";
  }

  return { time: timeComplexity, space: spaceComplexity };
};

function detectRecursion(code, language) {
  const fnNames = [];
  const lines = code.split("\n");
  for (const line of lines) {
    const match = line.match(/(?:function\s+(\w+)|def\s+(\w+)|void\s+(\w+)|int\s+(\w+))\s*\(/);
    if (match) {
      const name = match[1] || match[2] || match[3] || match[4];
      if (name && name !== "main" && name !== "solve") {
        fnNames.push(name);
      }
    }
  }

  for (const name of fnNames) {
    const occurrences = code.split(name + "(").length - 1;
    if (occurrences > 1) {
      return true;
    }
  }
  return false;
}
