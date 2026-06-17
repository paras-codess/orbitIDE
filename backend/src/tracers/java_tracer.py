"""
Java Code Tracer for orbitIDE Visualizer
Compiles Java code with javac, then runs it capturing stdout.
Provides line-flow tracing with program output.

Usage: python java_tracer.py <code_file> [stdin_file]
"""

import sys
import json
import subprocess
import os
import tempfile
import re
import platform
import shutil

MAX_STEPS = 2000
TIMEOUT_SECONDS = 15


def extract_class_name(code):
    """Extract the public class name from Java source code."""
    match = re.search(r'\bpublic\s+class\s+(\w+)', code)
    if match:
        return match.group(1)
    # Fallback: look for any class declaration
    match = re.search(r'\bclass\s+(\w+)', code)
    if match:
        return match.group(1)
    return "Main"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python java_tracer.py <code_file> [stdin_file]"}))
        sys.exit(1)

    code_file = os.path.abspath(sys.argv[1])
    stdin_file = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else None

    try:
        with open(code_file, "r", encoding="utf-8") as f:
            code = f.read()
    except Exception as e:
        print(json.dumps({"error": f"Failed to read code file: {str(e)}"}))
        sys.exit(1)

    code_lines = code.split("\n")
    class_name = extract_class_name(code)

    # Create temp directory for compilation
    tmp_dir = tempfile.mkdtemp(prefix="orbitide_java_")
    java_file = os.path.join(tmp_dir, f"{class_name}.java")

    try:
        with open(java_file, "w", encoding="utf-8") as f:
            f.write(code)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": f"Failed to write Java source: {str(e)}"}))
        sys.exit(1)

    # Compile
    try:
        compile_result = subprocess.run(
            ["javac", java_file],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            cwd=tmp_dir
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": "Compilation timed out (15s)."}))
        sys.exit(1)
    except FileNotFoundError:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": "javac not found. Please install JDK."}))
        sys.exit(1)

    if compile_result.returncode != 0:
        error_msg = compile_result.stderr.strip()
        # Make error paths relative for cleaner display
        error_msg = error_msg.replace(tmp_dir + os.sep, "")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": f"Compilation Error:\n{error_msg}", "traces": []}))
        sys.exit(0)

    # Run
    stdin_data = None
    if stdin_file and os.path.exists(stdin_file):
        with open(stdin_file, "r", encoding="utf-8") as f:
            stdin_data = f.read()

    try:
        run_result = subprocess.run(
            ["java", "-cp", tmp_dir, class_name],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            input=stdin_data,
            cwd=tmp_dir
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": "Time Limit Exceeded (15s). Possible infinite loop.", "traces": []}))
        sys.exit(0)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(json.dumps({"error": f"Runtime error: {str(e)}", "traces": []}))
        sys.exit(0)

    stdout_output = run_result.stdout
    stderr_output = run_result.stderr.strip()

    # Build simplified line-flow traces
    traces = []
    for i, line in enumerate(code_lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*") or stripped == "}" or stripped == "{":
            continue
        traces.append({
            "line": i + 1,
            "event": "step_line",
            "func": "main",
            "variables": {},
            "stdout": ""
        })
        if len(traces) >= MAX_STEPS:
            break

    # Attach stdout to the last step
    if traces and stdout_output:
        traces[-1]["stdout"] = stdout_output

    result = {"traces": traces}
    if stderr_output and run_result.returncode != 0:
        result["error"] = f"Runtime Error:\n{stderr_output}"
    if stdout_output:
        result["stdout"] = stdout_output

    shutil.rmtree(tmp_dir, ignore_errors=True)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
