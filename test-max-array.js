/**
 * OrbitIDE — Wandbox API Verification Test
 * Tests C++ "Find Maximum in Array" with 4 test cases
 */

const testCases = [
  { input: "5\n3 9 1 4 7",       expected: "9" },
  { input: "3\n-5 -1 -10",       expected: "-1" },
  { input: "1\n42",              expected: "42" },
  { input: "4\n100 200 300 400", expected: "400" },
];

const code = `#include <iostream>
using namespace std;
int main() {
    int n; cin >> n;
    int mx = -1000000000;
    for(int i=0;i<n;i++){ int x; cin>>x; if(x>mx) mx=x; }
    cout << mx << endl;
    return 0;
}`;

async function runTest() {
  console.log("🚀 OrbitIDE — Wandbox API Verification");
  console.log("=".repeat(50));
  console.log(`Language: C++ | Compiler: gcc-head`);
  console.log(`Test cases: ${testCases.length}\n`);

  let allPassed = true;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const start = Date.now();

    const res = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        compiler: "gcc-head",
        stdin: tc.input,
      }),
    });

    const result = await res.json();
    const elapsed = Date.now() - start;
    const output = (result.program_output || "").trim();
    const passed = output === tc.expected;

    if (!passed) allPassed = false;

    console.log(`  Test ${i+1}: ${passed ? "✅ PASS" : "❌ FAIL"} (${elapsed}ms)`);
    console.log(`         Input:    "${tc.input.replace(/\n/g, "\\n")}"`);
    console.log(`         Expected: "${tc.expected}"`);
    console.log(`         Got:      "${output}"`);
    
    if (result.compiler_error) console.log(`         Compile Error: ${result.compiler_error}`);
    if (result.program_error) console.log(`         Runtime Error: ${result.program_error}`);
    if (result.signal) console.log(`         Signal: ${result.signal}`);
    console.log();
  }

  console.log("=".repeat(50));
  if (allPassed) {
    console.log("🎉 ALL 4 TESTS PASSED — Wandbox API is working perfectly!");
    console.log("   Your OrbitIDE backend is ready for live submissions.");
  } else {
    console.log("❌ Some tests failed. Check the output above.");
  }
}

runTest().catch(e => console.error("Fatal error:", e.message));
