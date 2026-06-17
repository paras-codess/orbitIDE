"""
Python Code Tracer for orbitIDE Visualizer
Uses sys.settrace() to capture variable snapshots at each line.
Reads code from a temp file, stdin from another temp file.
Outputs a JSON array of trace steps to stdout.

Usage: python python_tracer.py <code_file> [stdin_file]
"""

import sys
import json
import copy
import os

MAX_STEPS = 2000
MAX_STR_LEN = 200

def safe_repr(val, depth=0):
    """Safely serialize a value for JSON output."""
    if depth > 3:
        return "..."
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        if isinstance(val, float) and (val != val):  # NaN
            return "NaN"
        return val
    if isinstance(val, str):
        if len(val) > MAX_STR_LEN:
            return val[:MAX_STR_LEN] + "..."
        return val
    if isinstance(val, (list, tuple)):
        return [safe_repr(item, depth + 1) for item in val[:50]]
    if isinstance(val, dict):
        result = {}
        for k, v in list(val.items())[:30]:
            result[str(k)] = safe_repr(v, depth + 1)
        return result
    if isinstance(val, set):
        return [safe_repr(item, depth + 1) for item in list(val)[:50]]
    # For other types, use str representation
    try:
        s = repr(val)
        if len(s) > MAX_STR_LEN:
            s = s[:MAX_STR_LEN] + "..."
        return s
    except:
        return "<unrepresentable>"


def get_type_name(val):
    """Get a clean type name."""
    if val is None:
        return "NoneType"
    return type(val).__name__


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No code file provided"}))
        sys.exit(1)

    code_file = sys.argv[1]
    stdin_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        with open(code_file, "r", encoding="utf-8") as f:
            code = f.read()
    except Exception as e:
        print(json.dumps({"error": f"Failed to read code file: {str(e)}"}))
        sys.exit(1)

    # Redirect stdin if provided
    if stdin_file and os.path.exists(stdin_file):
        sys.stdin = open(stdin_file, "r", encoding="utf-8")

    # Capture stdout
    captured_stdout = []
    original_stdout = sys.stdout

    class StdoutCapture:
        def write(self, s):
            if s and s.strip():
                captured_stdout.append(s)
        def flush(self):
            pass

    traces = []
    code_lines = code.split("\n")
    step_count = [0]

    # The set of lines that belong to the user's code
    # (we ignore tracer infrastructure lines)
    code_filename = os.path.abspath(code_file)

    def trace_func(frame, event, arg):
        if step_count[0] >= MAX_STEPS:
            return None

        # Only trace the user's code file
        if frame.f_code.co_filename != code_filename:
            return trace_func

        if event == "line":
            line_no = frame.f_lineno
            if line_no < 1 or line_no > len(code_lines):
                return trace_func

            # Capture local variables
            local_vars = {}
            for name, val in frame.f_locals.items():
                if name.startswith("__") and name.endswith("__"):
                    continue
                if callable(val) and not isinstance(val, (list, dict, set, tuple)):
                    continue
                local_vars[name] = {
                    "value": safe_repr(val),
                    "type": get_type_name(val)
                }

            traces.append({
                "line": line_no,
                "event": "step_line",
                "func": frame.f_code.co_name,
                "variables": local_vars,
                "stdout": "".join(captured_stdout) if captured_stdout else ""
            })
            step_count[0] += 1

        elif event == "return":
            line_no = frame.f_lineno
            if line_no < 1 or line_no > len(code_lines):
                return trace_func

            local_vars = {}
            for name, val in frame.f_locals.items():
                if name.startswith("__") and name.endswith("__"):
                    continue
                if callable(val) and not isinstance(val, (list, dict, set, tuple)):
                    continue
                local_vars[name] = {
                    "value": safe_repr(val),
                    "type": get_type_name(val)
                }

            traces.append({
                "line": line_no,
                "event": "return",
                "func": frame.f_code.co_name,
                "variables": local_vars,
                "returnValue": safe_repr(arg),
                "stdout": "".join(captured_stdout) if captured_stdout else ""
            })
            step_count[0] += 1

        return trace_func

    # Run the user's code with tracing
    sys.stdout = StdoutCapture()
    compiled = compile(code, code_filename, "exec")
    user_globals = {"__name__": "__main__", "__file__": code_filename}

    error_msg = None
    try:
        sys.settrace(trace_func)
        exec(compiled, user_globals)
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
    finally:
        sys.settrace(None)
        sys.stdout = original_stdout

    result = {"traces": traces}
    if error_msg:
        result["error"] = error_msg
    if captured_stdout:
        result["stdout"] = "".join(captured_stdout)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
