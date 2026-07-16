import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { visualizerAPI } from "../services/api.js";
import "./Visualizer.css";

/* ════════════════════════════════════════════════════════════════════════
   Constants
   ════════════════════════════════════════════════════════════════════════ */
const LANG_OPTIONS = [
  { value: "javascript", label: "JavaScript", monacoLang: "javascript" },
  { value: "python",     label: "Python",     monacoLang: "python" },
  { value: "cpp",        label: "C++",        monacoLang: "cpp" },
  { value: "c",          label: "C",          monacoLang: "c" },
  { value: "java",       label: "Java",       monacoLang: "java" },
];

const BOILERPLATES = {
  javascript: `// Fibonacci — JavaScript
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

let result = fib(5);
console.log("fib(5) =", result);
`,
  python: `# Fibonacci with Memoization — Python
memo = {}

def fib(n):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

result = fib(6)
print("fib(6) =", result)
`,
  cpp: `// Two Sum — C++
#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

int main() {
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    unordered_map<int, int> seen;

    for (int i = 0; i < nums.size(); i++) {
        int complement = target - nums[i];
        if (seen.count(complement)) {
            cout << seen[complement] << ", " << i << endl;
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`,
  c: `// Two Sum — C
#include <stdio.h>

int main() {
    int nums[] = {2, 7, 11, 15};
    int target = 9;
    int n = 4;

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                printf("%d, %d\\n", i, j);
                return 0;
            }
        }
    }
    return 0;
}
`,
  java: `// Two Sum — Java
import java.util.HashMap;

public class Main {
    public static void main(String[] args) {
        int[] nums = {2, 7, 11, 15};
        int target = 9;
        HashMap<Integer, Integer> seen = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                System.out.println(seen.get(complement) + ", " + i);
                return;
            }
            seen.put(nums[i], i);
        }
    }
}
`,
};

const PANEL_TABS = [
  { id: "memory",    label: "🧠 Memory" },
  { id: "stack",     label: "🖥️ Call Stack" },
  { id: "variables", label: "📦 Variables" },
  { id: "tree",      label: "🌳 Recursion Tree" },
  { id: "grid",      label: "📊 DP Grid" },
  { id: "console",   label: "📟 Output" },
];

/* ════════════════════════════════════════════════════════════════════════
   Helper: detect arrays/matrices in variables for the DP Grid panel
   ════════════════════════════════════════════════════════════════════════ */
function findGridVariables(variables) {
  if (!variables) return [];
  const results = [];
  for (const [name, info] of Object.entries(variables)) {
    const val = info?.value ?? info;
    if (Array.isArray(val)) {
      // 2D array?
      if (val.length > 0 && Array.isArray(val[0])) {
        results.push({ name, value: val, is2D: true });
      } else if (val.length > 0) {
        results.push({ name, value: val, is2D: false });
      }
    }
  }
  return results;
}

/* ════════════════════════════════════════════════════════════════════════
   Helper: build recursion tree data from traces
   ════════════════════════════════════════════════════════════════════════ */
function buildRecursionTree(traces) {
  if (!traces || traces.length === 0) return null;

  // Check if there are any call / return events with function depth
  const callEvents = traces.filter(t => t.event === "call" && t.func !== "main" && t.func !== "<module>");
  if (callEvents.length === 0) return null;

  const nodes = [];
  const edges = [];
  const nodeStack = [];
  let nodeId = 0;

  for (let i = 0; i < traces.length; i++) {
    const t = traces[i];

    if (t.event === "call" && t.func !== "<module>") {
      const argsStr = t.callArgs
        ? Object.entries(t.callArgs)
            .map(([k, v]) => `${k}=${JSON.stringify(v?.value ?? v)}`)
            .join(", ")
        : "";
      const label = `${t.func}(${argsStr})`;

      const node = {
        id: nodeId++,
        label,
        func: t.func,
        status: "active",   // active, returned, memoized
        returnValue: null,
        traceIndex: i,
      };
      nodes.push(node);

      if (nodeStack.length > 0) {
        edges.push({
          from: nodeStack[nodeStack.length - 1].id,
          to: node.id,
        });
      }
      nodeStack.push(node);
    }

    if (t.event === "return" && nodeStack.length > 0) {
      const top = nodeStack[nodeStack.length - 1];
      if (top && top.func === t.func) {
        top.status = "returned";
        top.returnValue = t.returnValue;
        nodeStack.pop();
      }
    }
  }

  if (nodes.length === 0) return null;
  return { nodes, edges };
}

/* ════════════════════════════════════════════════════════════════════════
   Sub-component: CallStackPanel
   ════════════════════════════════════════════════════════════════════════ */
function CallStackPanel({ trace, prevTrace }) {
  const stack = trace?.stack;
  if (!stack || stack.length === 0) {
    return (
      <div className="empty-panel-notice">
        <p>No active call stack frames on this step.</p>
      </div>
    );
  }

  // Reverse so the deepest (active) frame is at top
  const reversedStack = [...stack].reverse();

  return (
    <div className="call-stack-panel">
      {reversedStack.map((frame, idx) => {
        const isActive = idx === 0;
        return (
          <div key={idx} className={`stack-frame-card ${isActive ? "active-frame" : ""}`}>
            <div className="stack-frame-header">
              <div>
                <span className="stack-frame-func">{frame.func}()</span>
                <span className="stack-frame-line"> — Line {frame.line}</span>
              </div>
              <span className="stack-frame-depth-badge">
                Depth {reversedStack.length - idx}
              </span>
            </div>
            <div className="stack-frame-vars">
              {frame.variables && Object.entries(frame.variables).map(([name, info]) => {
                const val = info?.value ?? info;
                const displayVal = typeof val === "object" ? JSON.stringify(val) : String(val);
                // Detect if changed from previous trace
                const prevVars = prevTrace?.stack?.[stack.length - 1 - idx]?.variables;
                const prevVal = prevVars?.[name]?.value ?? prevVars?.[name];
                const changed = prevVars !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val);
                return (
                  <span key={name} className={`var-chip ${changed ? "changed" : ""}`}>
                    <span className="var-chip-name">{name}</span>
                    <span className="var-chip-eq">=</span>
                    <span className="var-chip-value" title={displayVal}>{displayVal}</span>
                    {info?.refId && <span className="var-chip-ref">ref#{info.refId}</span>}
                  </span>
                );
              })}
              {(!frame.variables || Object.keys(frame.variables).length === 0) && (
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>no variables</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sub-component: VariablesPanel
   ════════════════════════════════════════════════════════════════════════ */
function VariablesPanel({ trace, prevTrace }) {
  const vars = trace?.variables;
  if (!vars || Object.keys(vars).length === 0) {
    return (
      <div className="empty-panel-notice">
        <p>No variables captured on this line.</p>
      </div>
    );
  }

  return (
    <table className="variables-table">
      <thead>
        <tr><th>Variable</th><th>Type</th><th>Value</th></tr>
      </thead>
      <tbody>
        {Object.entries(vars).map(([name, info]) => {
          let displayType, displayVal;
          if (typeof info === "object" && info !== null && "type" in info) {
            displayType = info.type;
            displayVal = info.value === null ? "null" :
              info.value === undefined ? "undefined" :
              typeof info.value === "object" ? JSON.stringify(info.value) :
              String(info.value);
          } else {
            displayType = typeof info;
            displayVal = info === null ? "null" :
              info === undefined ? "undefined" :
              typeof info === "object" ? JSON.stringify(info) :
              String(info);
          }

          const prevVal = prevTrace?.variables?.[name]?.value ?? prevTrace?.variables?.[name];
          const curVal = info?.value ?? info;
          const changed = prevTrace?.variables !== undefined &&
            prevTrace?.variables?.[name] !== undefined &&
            JSON.stringify(prevVal) !== JSON.stringify(curVal);

          return (
            <tr key={name} className={changed ? "var-changed" : ""}>
              <td className="var-name">
                {name}
                {info?.refId && <span className="var-ref-badge">ref#{info.refId}</span>}
              </td>
              <td className="var-type">{displayType}</td>
              <td className="var-val">{displayVal}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sub-component: RecursionTreePanel
   ════════════════════════════════════════════════════════════════════════ */
function RecursionTreePanel({ treeData, currentStep }) {
  if (!treeData) {
    return (
      <div className="empty-panel-notice">
        <p>No recursive function calls detected.<br/>
        Try running a recursive algorithm (e.g., Fibonacci, Merge Sort).</p>
      </div>
    );
  }

  const { nodes, edges } = treeData;

  // Simple tree layout: BFS level assignment
  const levels = {};
  const children = {};
  const roots = new Set(nodes.map(n => n.id));
  edges.forEach(e => {
    roots.delete(e.to);
    if (!children[e.from]) children[e.from] = [];
    children[e.from].push(e.to);
  });

  // BFS to assign levels
  const queue = [...roots];
  const visited = new Set();
  let level = 0;
  while (queue.length > 0) {
    const size = queue.length;
    if (!levels[level]) levels[level] = [];
    for (let i = 0; i < size; i++) {
      const nid = queue.shift();
      if (visited.has(nid)) continue;
      visited.add(nid);
      levels[level].push(nid);
      (children[nid] || []).forEach(c => queue.push(c));
    }
    level++;
  }

  const levelCount = Object.keys(levels).length;
  const maxNodesInLevel = Math.max(...Object.values(levels).map(l => l.length), 1);

  const nodeWidth = 110;
  const nodeHeight = 50;
  const hGap = 24;
  const vGap = 60;

  const svgWidth = Math.max(maxNodesInLevel * (nodeWidth + hGap), 300);
  const svgHeight = levelCount * (nodeHeight + vGap) + 40;

  // Position each node
  const nodePositions = {};
  Object.entries(levels).forEach(([lvl, nodeIds]) => {
    const totalWidth = nodeIds.length * nodeWidth + (nodeIds.length - 1) * hGap;
    const startX = (svgWidth - totalWidth) / 2;
    nodeIds.forEach((nid, idx) => {
      nodePositions[nid] = {
        x: startX + idx * (nodeWidth + hGap) + nodeWidth / 2,
        y: parseInt(lvl) * (nodeHeight + vGap) + 30,
      };
    });
  });

  const getNodeColor = (node) => {
    if (node.traceIndex > currentStep) return "rgba(100,116,139,0.4)";
    if (node.traceIndex === currentStep) return "#6366f1";
    if (node.status === "returned") return "#22c55e";
    return "#6366f1";
  };

  return (
    <div className="recursion-tree-panel">
      <svg width={svgWidth} height={svgHeight}>
        {/* Edges */}
        {edges.map((e, i) => {
          const from = nodePositions[e.from];
          const to = nodePositions[e.to];
          if (!from || !to) return null;
          const isActive = nodes[e.to]?.traceIndex <= currentStep;
          return (
            <line
              key={i}
              className={`tree-edge ${isActive ? "active" : ""}`}
              x1={from.x} y1={from.y + 16}
              x2={to.x} y2={to.y - 16}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const color = getNodeColor(node);
          const truncLabel = node.label.length > 18
            ? node.label.slice(0, 16) + "…"
            : node.label;

          return (
            <g key={node.id}>
              <rect
                className="tree-node-circle"
                x={pos.x - nodeWidth / 2 + 5}
                y={pos.y - 16}
                width={nodeWidth - 10}
                height={32}
                rx={6}
                fill={color}
                opacity={node.traceIndex > currentStep ? 0.3 : 0.9}
              />
              <text className="tree-node-text" x={pos.x} y={pos.y}>
                {truncLabel}
              </text>
              {node.status === "returned" && node.traceIndex <= currentStep && (
                <text
                  x={pos.x}
                  y={pos.y + 24}
                  textAnchor="middle"
                  fill="#86efac"
                  fontSize="9"
                  fontFamily="Courier New"
                  fontWeight="700"
                >
                  → {JSON.stringify(node.returnValue)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sub-component: DPGridPanel
   ════════════════════════════════════════════════════════════════════════ */
function DPGridPanel({ trace, prevTrace }) {
  const grids = findGridVariables(trace?.variables);
  if (grids.length === 0) {
    return (
      <div className="empty-panel-notice">
        <p>No arrays or matrices detected.<br/>
        Try running a DP algorithm with a dp/memo table.</p>
      </div>
    );
  }

  // Find which cells changed from the previous step
  const prevGrids = findGridVariables(prevTrace?.variables);

  return (
    <div className="dp-grid-panel">
      {grids.map(grid => {
        const prevGrid = prevGrids.find(g => g.name === grid.name);
        if (grid.is2D) {
          return (
            <div key={grid.name}>
              <div className="dp-grid-label">{grid.name} (2D — {grid.value.length}×{grid.value[0]?.length || 0})</div>
              <div className="dp-grid-container">
                <table className="dp-grid-table">
                  <thead>
                    <tr>
                      <th></th>
                      {(grid.value[0] || []).map((_, ci) => <th key={ci}>{ci}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.value.map((row, ri) => (
                      <tr key={ri}>
                        <td className="dp-grid-row-header">{ri}</td>
                        {(Array.isArray(row) ? row : []).map((cell, ci) => {
                          const prevCell = prevGrid?.value?.[ri]?.[ci];
                          const changed = prevGrid && JSON.stringify(prevCell) !== JSON.stringify(cell);
                          return (
                            <td key={ci} className={changed ? "cell-active" : ""}>
                              {cell === null || cell === undefined ? "—" : String(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // 1D array
        return (
          <div key={grid.name}>
            <div className="dp-grid-label">{grid.name} (1D — length {grid.value.length})</div>
            <div className="dp-grid-container">
              <table className="dp-grid-table">
                <thead>
                  <tr>
                    {grid.value.map((_, ci) => <th key={ci}>{ci}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {grid.value.map((cell, ci) => {
                      const prevCell = prevGrid?.value?.[ci];
                      const changed = prevGrid && JSON.stringify(prevCell) !== JSON.stringify(cell);
                      return (
                        <td key={ci} className={changed ? "cell-active" : ""}>
                          {cell === null || cell === undefined ? "—" : String(cell)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Helper: categorize variables into visual groups for Memory panel
   ════════════════════════════════════════════════════════════════════════ */
function categorizeVariables(variables) {
  if (!variables) return { primitives: [], arrays1D: [], arrays2D: [], dicts: [], strings: [] };

  const primitives = [];
  const arrays1D = [];
  const arrays2D = [];
  const dicts = [];
  const strings = [];

  for (const [name, info] of Object.entries(variables)) {
    const val = info?.value ?? info;
    const type = (info?.type || typeof val || "").toLowerCase();

    // 2D array
    if (Array.isArray(val) && val.length > 0 && Array.isArray(val[0])) {
      arrays2D.push({ name, value: val, type });
    }
    // 1D array / list / tuple / set
    else if (Array.isArray(val)) {
      arrays1D.push({ name, value: val, type });
    }
    // Dict / object (not null, not array)
    else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      dicts.push({ name, value: val, type });
    }
    // String shown as char array if long enough
    else if (typeof val === "string" && val.length > 1 && type === "str") {
      strings.push({ name, value: val, type });
    }
    // Primitive (number, bool, short string, null, undefined)
    else {
      primitives.push({ name, value: val, type });
    }
  }

  return { primitives, arrays1D, arrays2D, dicts, strings };
}

/* ════════════════════════════════════════════════════════════════════════
   Sub-component: MemoryPanel — Animated memory visualization
   ════════════════════════════════════════════════════════════════════════ */
function MemoryPanel({ trace, prevTrace }) {
  const vars = trace?.variables;
  const prevVars = prevTrace?.variables;

  if (!vars || Object.keys(vars).length === 0) {
    return (
      <div className="empty-panel-notice">
        <p>No variables captured on this step.<br />
        Try running code with arrays, lists, or variables to see them visualized.</p>
      </div>
    );
  }

  const { primitives, arrays1D, arrays2D, dicts, strings } = categorizeVariables(vars);
  const prevCategorized = categorizeVariables(prevVars);
  const prevVarNames = prevVars ? new Set(Object.keys(prevVars)) : new Set();

  // Helper: check if a variable is newly created
  const isNew = (name) => !prevVarNames.has(name);

  // Helper: check if a primitive value changed
  const hasChanged = (name) => {
    if (!prevVars || !prevVars[name]) return false;
    const prev = prevVars[name]?.value ?? prevVars[name];
    const cur = vars[name]?.value ?? vars[name];
    return JSON.stringify(prev) !== JSON.stringify(cur);
  };

  // Helper: check if a specific cell in an array changed
  const cellChanged = (name, ...indices) => {
    if (!prevVars || !prevVars[name]) return false;
    const prevVal = prevVars[name]?.value ?? prevVars[name];
    const curVal = vars[name]?.value ?? vars[name];
    let prev = prevVal;
    let cur = curVal;
    for (const idx of indices) {
      prev = prev?.[idx];
      cur = cur?.[idx];
    }
    return JSON.stringify(prev) !== JSON.stringify(cur);
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "string") return val;
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="memory-panel">
      {/* ── Primitives ── */}
      {primitives.length > 0 && (
        <div className="memory-section">
          <div className="memory-section-title">Variables</div>
          <div className="memory-primitives-row">
            {primitives.map(({ name, value, type }) => {
              const changed = hasChanged(name);
              const fresh = isNew(name);
              return (
                <div
                  key={name}
                  className={`memory-block memory-primitive ${
                    fresh ? "mem-new" : changed ? "mem-changed" : ""
                  }`}
                >
                  <div className="memory-block-label">{name}</div>
                  <div className={`memory-cell-single ${changed ? "cell-glow" : ""}`}>
                    {formatValue(value)}
                  </div>
                  <div className="memory-type-badge">{type}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Strings as char arrays ── */}
      {strings.map(({ name, value }) => {
        const fresh = isNew(name);
        const chars = value.split("");
        return (
          <div key={name} className={`memory-section ${fresh ? "mem-new" : ""}`}>
            <div className="memory-section-title">
              <span className="memory-var-name">{name}</span>
              <span className="memory-meta">str — length {value.length}</span>
            </div>
            <div className="memory-array-row">
              {chars.slice(0, 50).map((ch, ci) => {
                const changed = cellChanged(name) && prevVars;
                return (
                  <div key={ci} className={`memory-cell ${changed ? "cell-glow" : ""}`}
                    style={{ animationDelay: fresh ? `${ci * 40}ms` : "0ms" }}>
                    <div className="memory-cell-value">&apos;{ch}&apos;</div>
                    <div className="memory-cell-index">[{ci}]</div>
                  </div>
                );
              })}
              {value.length > 50 && <div className="memory-cell memory-cell-more">…</div>}
            </div>
          </div>
        );
      })}

      {/* ── 1D Arrays ── */}
      {arrays1D.map(({ name, value, type }) => {
        const fresh = isNew(name);
        return (
          <div key={name} className={`memory-section ${fresh ? "mem-new" : ""}`}>
            <div className="memory-section-title">
              <span className="memory-var-name">{name}</span>
              <span className="memory-meta">{type || "list"} — length {value.length}</span>
            </div>
            <div className="memory-array-row">
              {value.slice(0, 50).map((cell, ci) => {
                const changed = cellChanged(name, ci);
                return (
                  <div
                    key={ci}
                    className={`memory-cell ${changed ? "cell-glow" : ""} ${fresh ? "mem-cascade" : ""}`}
                    style={{ animationDelay: fresh ? `${ci * 50}ms` : "0ms" }}
                  >
                    <div className="memory-cell-value">{formatValue(cell)}</div>
                    <div className="memory-cell-index">[{ci}]</div>
                  </div>
                );
              })}
              {value.length > 50 && <div className="memory-cell memory-cell-more">…</div>}
            </div>
          </div>
        );
      })}

      {/* ── 2D Arrays / Matrices ── */}
      {arrays2D.map(({ name, value, type }) => {
        const fresh = isNew(name);
        const cols = value[0]?.length || 0;
        return (
          <div key={name} className={`memory-section ${fresh ? "mem-new" : ""}`}>
            <div className="memory-section-title">
              <span className="memory-var-name">{name}</span>
              <span className="memory-meta">{type || "matrix"} — {value.length}×{cols}</span>
            </div>
            <div className="memory-grid-2d">
              {/* Column headers */}
              <div className="memory-grid-row memory-grid-header-row">
                <div className="memory-grid-corner"></div>
                {Array.from({ length: cols }).map((_, ci) => (
                  <div key={ci} className="memory-grid-col-header">[{ci}]</div>
                ))}
              </div>
              {/* Data rows */}
              {value.slice(0, 20).map((row, ri) => (
                <div key={ri} className="memory-grid-row">
                  <div className="memory-grid-row-header">[{ri}]</div>
                  {(Array.isArray(row) ? row : []).slice(0, 20).map((cell, ci) => {
                    const changed = cellChanged(name, ri, ci);
                    return (
                      <div
                        key={ci}
                        className={`memory-cell ${changed ? "cell-glow" : ""} ${fresh ? "mem-cascade" : ""}`}
                        style={{ animationDelay: fresh ? `${(ri * cols + ci) * 30}ms` : "0ms" }}
                      >
                        <div className="memory-cell-value">{formatValue(cell)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Dicts / Maps ── */}
      {dicts.map(({ name, value, type }) => {
        const fresh = isNew(name);
        const entries = Object.entries(value);
        const prevDict = prevCategorized.dicts.find(d => d.name === name);
        return (
          <div key={name} className={`memory-section ${fresh ? "mem-new" : ""}`}>
            <div className="memory-section-title">
              <span className="memory-var-name">{name}</span>
              <span className="memory-meta">{type || "dict"} — {entries.length} entries</span>
            </div>
            <div className="memory-dict-grid">
              {entries.slice(0, 30).map(([key, val], idx) => {
                const prevVal = prevDict?.value?.[key];
                const changed = prevDict && JSON.stringify(prevVal) !== JSON.stringify(val);
                const isNewKey = prevDict && !(key in prevDict.value);
                return (
                  <div
                    key={key}
                    className={`memory-dict-entry ${
                      isNewKey ? "mem-new" : changed ? "mem-changed" : ""
                    }`}
                    style={{ animationDelay: fresh ? `${idx * 50}ms` : "0ms" }}
                  >
                    <div className="memory-dict-key">{key}</div>
                    <div className="memory-dict-arrow">→</div>
                    <div className={`memory-dict-value ${changed ? "cell-glow" : ""}`}>
                      {formatValue(val)}
                    </div>
                  </div>
                );
              })}
              {entries.length > 30 && (
                <div className="memory-dict-entry memory-cell-more">… {entries.length - 30} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Main Visualizer Component
   ════════════════════════════════════════════════════════════════════════ */
function Visualizer() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(BOILERPLATES.python);
  const [stdin, setStdin] = useState("");
  const [traces, setTraces] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [activePanel, setActivePanel] = useState("memory");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(600); // ms per step

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const playIntervalRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(BOILERPLATES[newLang] || "");
    setTraces([]);
    setCurrentStep(0);
    setError(null);
    setConsoleOutput("");
    stopPlaying();
  };

  // Clear decorations on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && decorationsRef.current.length > 0) {
        editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
      stopPlaying();
    };
  }, []);

  // Update editor line highlight when step changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current && traces.length > 0 && currentStep < traces.length) {
      const line = traces[currentStep].line;
      const monaco = monacoRef.current;
      const editor = editorRef.current;

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "visualizer-line-highlight",
            glyphMarginClassName: "visualizer-glyph-arrow",
          },
        },
      ]);
      editor.revealLineInCenterIfOutsideViewport(line);
    } else if (editorRef.current && traces.length === 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, [currentStep, traces]);

  // ─── Auto-play logic ─────────────────────────────────────────
  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopPlaying();
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= traces.length - 1) {
            stopPlaying();
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    }
  }, [isPlaying, traces.length, playSpeed, stopPlaying]);

  // Stop playing when traces change
  useEffect(() => {
    stopPlaying();
  }, [traces, stopPlaying]);

  // ─── Client-side JS instrumentation ──────────────────────────
  const runClientSideJS = () => {
    const capturedTraces = [];

    const record = (lineNum, variableScope) => {
      const scopeClone = {};
      for (const key in variableScope) {
        if (typeof variableScope[key] === "function") continue;
        if (typeof variableScope[key] === "object" && variableScope[key] !== null) {
          try { scopeClone[key] = JSON.parse(JSON.stringify(variableScope[key])); }
          catch (e) { scopeClone[key] = "[Circular]"; }
        } else {
          scopeClone[key] = variableScope[key];
        }
      }
      capturedTraces.push({ line: lineNum, variables: scopeClone });
    };

    window.__recordStep = record;

    const lines = code.split("\n");
    const declaredVars = new Set();

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      const varMatches = trimmed.matchAll(/\b(let|const|var)\s+(\w+)\b/g);
      for (const match of varMatches) declaredVars.add(match[2]);
      const funcMatches = trimmed.matchAll(/\bfunction\s+(\w+)\s*\(([^)]*)\)/g);
      for (const match of funcMatches) {
        declaredVars.add(match[1]);
        match[2].split(",").map(p => p.trim().split("=")[0].trim())
          .filter(p => p && /^[a-zA-Z_$]\w*$/.test(p)).forEach(p => declaredVars.add(p));
      }
    }

    const getScopeExpr = () => {
      if (declaredVars.size === 0) return "{}";
      const assignments = Array.from(declaredVars)
        .map((v) => `try { _s.${v} = ${v}; } catch(e) {}`)
        .join(" ");
      return `(() => { let _s = {}; ${assignments} return _s; })()`;
    };

    const instrumentedLines = [];
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        instrumentedLines.push(rawLine);
        continue;
      }
      instrumentedLines.push(`window.__recordStep(${i + 1}, ${getScopeExpr()});`);
      instrumentedLines.push(rawLine);
    }
    instrumentedLines.push(`window.__recordStep(${lines.length}, ${getScopeExpr()});`);

    const runCodeStr = instrumentedLines.join("\n");

    const mockFs = { readFileSync: () => stdin };
    const mockRequire = (mod) => { if (mod === "fs") return mockFs; throw new Error(`Module "${mod}" not available`); };
    const mockProcess = {
      stdin: { fd: 0, read: () => stdin },
      stdout: { write: (s) => console.log(s) },
      exit: (c) => { throw new Error(`process.exit(${c})`); }
    };

    try {
      const executor = new Function("require", "process", runCodeStr);
      executor(mockRequire, mockProcess);
      if (capturedTraces.length === 0) throw new Error("No executable lines found.");

      const normalizedTraces = capturedTraces.map((t, idx) => ({
        line: t.line,
        event: "step_line",
        func: "main",
        variables: Object.fromEntries(
          Object.entries(t.variables).map(([k, v]) => [k, {
            value: v === null ? null : v === undefined ? "undefined" : typeof v === "object" ? JSON.stringify(v) : v,
            type: v === null ? "null" : typeof v
          }])
        ),
        stdout: "",
        narration: `▶️ Executing line ${t.line}.`,
      }));

      return { traces: normalizedTraces };
    } catch (err) {
      return { traces: [], error: err.message };
    } finally {
      delete window.__recordStep;
    }
  };

  // ─── Main visualize handler ──────────────────────────────────
  const handleVisualize = async () => {
    setIsRunning(true);
    setError(null);
    setTraces([]);
    setCurrentStep(0);
    setConsoleOutput("");
    stopPlaying();

    try {
      let result;

      if (language === "javascript") {
        result = runClientSideJS();
      } else {
        result = await visualizerAPI.visualize(language, code, stdin);
      }

      if (result.error) {
        setError(result.error);
      }

      if (result.traces && result.traces.length > 0) {
        setTraces(result.traces);
        setCurrentStep(0);
      }

      if (result.stdout) {
        setConsoleOutput(result.stdout);
      }

    } catch (err) {
      setError(err.message || "Failed to visualize code.");
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Derived data ────────────────────────────────────────────
  const currentSnapshot = traces[currentStep] || null;
  const prevSnapshot = currentStep > 0 ? traces[currentStep - 1] : null;
  const currentLangOption = LANG_OPTIONS.find(l => l.value === language);

  const treeData = useMemo(() => buildRecursionTree(traces), [traces]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="visualizer-page container">
      <header className="visualizer-header">
        <h1>Code Execution Visualizer</h1>
        <p>Paste any code and watch every step of execution — call stacks, variables, recursion trees, and DP tables come alive.</p>
      </header>

      <div className="visualizer-workspace glass-card">
        {/* ─── Left Panel: Editor + Stdin ─── */}
        <div className="visualizer-editor-section">
          <div className="section-bar">
            <div className="section-bar-left">
              <div className="language-selector">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`lang-btn ${language === opt.value ? "active" : ""}`}
                    onClick={() => handleLanguageChange(opt.value)}
                    disabled={isRunning}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn-primary run-visualizer-btn"
              onClick={handleVisualize}
              disabled={isRunning}
            >
              {isRunning ? "⏳ Running..." : "🎬 Visualize"}
            </button>
          </div>
          <div className="visualizer-editor-container">
            <Editor
              height="100%"
              language={currentLangOption?.monacoLang || "javascript"}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                cursorBlinking: "smooth",
                fontFamily: "'Courier New', Courier, monospace",
                glyphMargin: true,
              }}
            />
          </div>
          <div className="visualizer-stdin-container">
            <div className="section-bar sub-bar">
              <span>📥 Standard Input (stdin)</span>
            </div>
            <textarea
              className="visualizer-stdin-textarea"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Provide standard input here (one value per line)..."
            />
          </div>
        </div>

        {/* ─── Right Panel: Inspector ─── */}
        <div className="visualizer-inspector-section">
          {traces.length > 0 ? (
            <>
              {/* Error */}
              {error && (
                <div className="visualizer-error-banner" style={{ margin: "0.75rem 0.75rem 0" }}>
                  <span>⚠️ Error:</span> {error}
                </div>
              )}

              {/* Step Controls */}
              <div style={{ padding: "0.75rem 0.75rem 0", flexShrink: 0 }}>
                <div className="controls-card">
                  <div className="controls-row">
                    <button disabled={currentStep === 0} onClick={() => { setCurrentStep(0); stopPlaying(); }} className="control-btn">
                      ⏮
                    </button>
                    <button disabled={currentStep === 0} onClick={() => { setCurrentStep(prev => prev - 1); stopPlaying(); }} className="control-btn">
                      ◀
                    </button>
                    <button onClick={togglePlay} className="control-btn play-btn">
                      {isPlaying ? "⏸" : "▶"}
                    </button>
                    <button disabled={currentStep === traces.length - 1} onClick={() => { setCurrentStep(prev => prev + 1); stopPlaying(); }} className="control-btn">
                      ▶
                    </button>
                    <button disabled={currentStep === traces.length - 1} onClick={() => { setCurrentStep(traces.length - 1); stopPlaying(); }} className="control-btn">
                      ⏭
                    </button>
                    <span className="step-info-label">
                      {currentStep + 1} / {traces.length}
                    </span>
                    <select
                      value={playSpeed}
                      onChange={(e) => setPlaySpeed(Number(e.target.value))}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                        borderRadius: "4px",
                        padding: "0.2rem 0.3rem",
                        fontSize: "0.68rem",
                        cursor: "pointer",
                      }}
                    >
                      <option value={1200}>0.5×</option>
                      <option value={600}>1×</option>
                      <option value={300}>2×</option>
                      <option value={150}>4×</option>
                    </select>
                  </div>
                  <input
                    type="range" min="0" max={traces.length - 1} value={currentStep}
                    onChange={(e) => { setCurrentStep(parseInt(e.target.value)); stopPlaying(); }}
                    className="timeline-slider"
                  />
                </div>
              </div>

              {/* Narration */}
              {currentSnapshot?.narration && (
                <div style={{ padding: "0 0.75rem", flexShrink: 0 }}>
                  <div className="narration-box">
                    <div className="narration-label">Step Explanation</div>
                    {currentSnapshot.narration}
                  </div>
                </div>
              )}

              {/* Function & Line info */}
              <div style={{ padding: "0 0.75rem", flexShrink: 0 }}>
                <div className="active-line-badge">
                  <span className="func-badge">{currentSnapshot?.func || "main"}()</span>
                  &nbsp;→ Line <span>{currentSnapshot?.line}</span>
                  {currentSnapshot?.event === "call" && <span style={{ color: "#818cf8", marginLeft: "0.5rem" }}>📞 CALL</span>}
                  {currentSnapshot?.event === "return" && <span style={{ color: "#22c55e", marginLeft: "0.5rem" }}>↩️ RETURN</span>}
                </div>
              </div>

              {/* Panel Tabs */}
              <div className="panel-tabs">
                {PANEL_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`panel-tab ${activePanel === tab.id ? "active" : ""}`}
                    onClick={() => setActivePanel(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="panel-content-area">
                {activePanel === "memory" && (
                  <MemoryPanel trace={currentSnapshot} prevTrace={prevSnapshot} />
                )}
                {activePanel === "stack" && (
                  <CallStackPanel trace={currentSnapshot} prevTrace={prevSnapshot} />
                )}
                {activePanel === "variables" && (
                  <VariablesPanel trace={currentSnapshot} prevTrace={prevSnapshot} />
                )}
                {activePanel === "tree" && (
                  <RecursionTreePanel treeData={treeData} currentStep={currentStep} />
                )}
                {activePanel === "grid" && (
                  <DPGridPanel trace={currentSnapshot} prevTrace={prevSnapshot} />
                )}
                {activePanel === "console" && (
                  <div className="console-output-card">
                    <h4>📟 Program Output</h4>
                    <pre className="console-output-pre">
                      {currentSnapshot?.stdout || consoleOutput || "(no output yet)"}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-inspector-notice">
              {error && (
                <div className="visualizer-error-banner" style={{ marginBottom: "1rem", textAlign: "left" }}>
                  <span>⚠️ Error:</span> {error}
                </div>
              )}
              <span className="empty-visualizer-icon">🎬</span>
              <h3>No Trace Generated</h3>
              <p>Select a language, write or paste your code, and click &quot;Visualize&quot; to step through execution.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Visualizer;
