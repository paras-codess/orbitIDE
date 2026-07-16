"""
Python Code Tracer for orbitIDE Visualizer (v2 — Educational Edition)
Uses sys.settrace() to capture full call-stack snapshots at each line,
including heap reference tracking and step narration.

Reads code from a temp file, stdin from another temp file.
Outputs a JSON object with enriched trace steps to stdout.

Usage: python python_tracer.py <code_file> [stdin_file]
"""

import sys
import json
import copy
import os

MAX_STEPS = 2000
MAX_STR_LEN = 200


# ── Heap Reference Tracker ──────────────────────────────────────────────
class HeapTracker:
    """Assigns stable integer IDs to mutable objects so the frontend can
    detect when two variables point to the same list/dict/set in memory."""

    def __init__(self):
        self._id_map = {}   # python id() -> our stable int id
        self._next_id = 1

    def get_ref_id(self, obj):
        """Return a stable reference id for *obj* if it is a mutable
        container (list, dict, set).  Returns None for immutables."""
        if not isinstance(obj, (list, dict, set)):
            return None
        py_id = id(obj)
        if py_id not in self._id_map:
            self._id_map[py_id] = self._next_id
            self._next_id += 1
        return self._id_map[py_id]

    def reset(self):
        self._id_map.clear()
        self._next_id = 1


# ── Safe serialisation helpers ──────────────────────────────────────────
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
    except Exception:
        return "<unrepresentable>"


def get_type_name(val):
    """Get a clean type name."""
    if val is None:
        return "NoneType"
    return type(val).__name__


def capture_variables(frame, heap_tracker):
    """Return a dict of {name: {value, type, refId?}} for the locals
    in *frame*, skipping dunders and bare callables."""
    local_vars = {}
    for name, val in frame.f_locals.items():
        if name.startswith("__") and name.endswith("__"):
            continue
        if callable(val) and not isinstance(val, (list, dict, set, tuple)):
            continue
        entry = {
            "value": safe_repr(val),
            "type": get_type_name(val),
        }
        ref_id = heap_tracker.get_ref_id(val)
        if ref_id is not None:
            entry["refId"] = ref_id
        local_vars[name] = entry
    return local_vars


def capture_stack(frame, code_filename, heap_tracker):
    """Walk *frame* upward and return a list of stack-frame dicts
    (bottom-most first → top-most last) that belong to the user's file."""
    frames = []
    f = frame
    while f is not None:
        if f.f_code.co_filename == code_filename:
            func_name = f.f_code.co_name
            # Determine which local names were formal parameters
            argcount = f.f_code.co_argcount
            varnames = f.f_code.co_varnames[:argcount]
            args = {}
            for vn in varnames:
                if vn in f.f_locals:
                    args[vn] = {
                        "value": safe_repr(f.f_locals[vn]),
                        "type": get_type_name(f.f_locals[vn]),
                    }
                    ref_id = heap_tracker.get_ref_id(f.f_locals[vn])
                    if ref_id is not None:
                        args[vn]["refId"] = ref_id

            frames.append({
                "func": func_name if func_name != "<module>" else "main",
                "line": f.f_lineno,
                "variables": capture_variables(f, heap_tracker),
                "args": args,
            })
        f = f.f_back
    frames.reverse()  # bottom (module) first, deepest call last
    return frames


def narrate_step(event, func_name, line_no, code_lines, variables, return_value=None):
    """Return a short human-readable sentence describing what is happening
    at this execution step — designed for students learning to code."""
    line_text = ""
    if 1 <= line_no <= len(code_lines):
        line_text = code_lines[line_no - 1].strip()

    if event == "call":
        args_str = ""
        if variables:
            parts = []
            for k, v in variables.items():
                parts.append(f"{k}={json.dumps(v.get('value', '?'))}")
            args_str = ", ".join(parts)
        return f"📞 Function '{func_name}({args_str})' is called."

    if event == "return":
        rv = json.dumps(return_value) if return_value is not None else "None"
        return f"↩️ Function '{func_name}' returns {rv}."

    # step_line
    if not line_text:
        return f"Executing line {line_no}."

    # Try to describe common patterns
    if "=" in line_text and not line_text.startswith("if") and not line_text.startswith("for") and "==" not in line_text and "!=" not in line_text:
        lhs = line_text.split("=")[0].strip()
        return f"📝 Assigning variable '{lhs}' on line {line_no}."

    if line_text.startswith("for "):
        return f"🔄 Entering a 'for' loop on line {line_no}."

    if line_text.startswith("while "):
        return f"🔄 Evaluating 'while' condition on line {line_no}."

    if line_text.startswith("if "):
        return f"❓ Checking condition on line {line_no}: {line_text}"

    if line_text.startswith("elif "):
        return f"❓ Checking 'elif' condition on line {line_no}: {line_text}"

    if line_text.startswith("else"):
        return f"➡️ Entering 'else' branch on line {line_no}."

    if line_text.startswith("return"):
        return f"↩️ Returning value on line {line_no}: {line_text}"

    if line_text.startswith("print"):
        return f"🖨️ Printing output on line {line_no}."

    if line_text.startswith("def "):
        return f"📋 Defining function on line {line_no}: {line_text}"

    return f"▶️ Executing line {line_no}: {line_text}"


# ── Main ────────────────────────────────────────────────────────────────
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
    code_filename = os.path.abspath(code_file)
    heap_tracker = HeapTracker()

    def trace_func(frame, event, arg):
        if step_count[0] >= MAX_STEPS:
            return None

        # Only trace the user's code file
        if frame.f_code.co_filename != code_filename:
            return trace_func

        if event == "call":
            line_no = frame.f_lineno
            if line_no < 1 or line_no > len(code_lines):
                return trace_func

            func_name = frame.f_code.co_name
            if func_name == "<module>":
                func_name = "main"

            # Capture arguments for this call
            argcount = frame.f_code.co_argcount
            varnames = frame.f_code.co_varnames[:argcount]
            call_args = {}
            for vn in varnames:
                if vn in frame.f_locals:
                    call_args[vn] = {
                        "value": safe_repr(frame.f_locals[vn]),
                        "type": get_type_name(frame.f_locals[vn]),
                    }
                    ref_id = heap_tracker.get_ref_id(frame.f_locals[vn])
                    if ref_id is not None:
                        call_args[vn]["refId"] = ref_id

            stack = capture_stack(frame, code_filename, heap_tracker)

            narration = narrate_step("call", func_name, line_no, code_lines, call_args)

            traces.append({
                "line": line_no,
                "event": "call",
                "func": func_name,
                "variables": capture_variables(frame, heap_tracker),
                "callArgs": call_args,
                "stack": stack,
                "stdout": "".join(captured_stdout) if captured_stdout else "",
                "narration": narration,
            })
            step_count[0] += 1

        elif event == "line":
            line_no = frame.f_lineno
            if line_no < 1 or line_no > len(code_lines):
                return trace_func

            func_name = frame.f_code.co_name
            if func_name == "<module>":
                func_name = "main"

            variables = capture_variables(frame, heap_tracker)
            stack = capture_stack(frame, code_filename, heap_tracker)

            narration = narrate_step("step_line", func_name, line_no, code_lines, variables)

            traces.append({
                "line": line_no,
                "event": "step_line",
                "func": func_name,
                "variables": variables,
                "stack": stack,
                "stdout": "".join(captured_stdout) if captured_stdout else "",
                "narration": narration,
            })
            step_count[0] += 1

        elif event == "return":
            line_no = frame.f_lineno
            if line_no < 1 or line_no > len(code_lines):
                return trace_func

            func_name = frame.f_code.co_name
            if func_name == "<module>":
                func_name = "main"

            variables = capture_variables(frame, heap_tracker)
            stack = capture_stack(frame, code_filename, heap_tracker)
            return_val = safe_repr(arg)

            narration = narrate_step("return", func_name, line_no, code_lines, variables, return_val)

            traces.append({
                "line": line_no,
                "event": "return",
                "func": func_name,
                "variables": variables,
                "returnValue": return_val,
                "stack": stack,
                "stdout": "".join(captured_stdout) if captured_stdout else "",
                "narration": narration,
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
