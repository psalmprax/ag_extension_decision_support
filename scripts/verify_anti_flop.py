#!/usr/bin/env python3
"""Anti-Flop Verification Suite for Agri-Extension Decision Support System.
Validates production-readiness, zero dead stubs, error handling hygiene, and contract integrity.
"""
import os
import re
import subprocess
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def check_no_dead_stubs():
    """Scan backend and agent source files for dead stubs or unhandled placeholders."""
    errors = []
    stub_patterns = [
        re.compile(r"throw new Error\([\"']Not implemented[\"']\)"),
        re.compile(r"raise NotImplementedError"),
    ]

    target_dirs = [
        os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "backend", "src"),
        os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "agents", "tools"),
    ]

    for target_dir in target_dirs:
        if not os.path.exists(target_dir):
            continue
        for root, _, files in os.walk(target_dir):
            if "__tests__" in root or "tests" in root:
                continue
            for file in files:
                if not file.endswith((".ts", ".py")):
                    continue
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line_no, line in enumerate(f, 1):
                            for pattern in stub_patterns:
                                if pattern.search(line):
                                    rel_path = os.path.relpath(file_path, REPO_ROOT)
                                    errors.append(f"{rel_path}:{line_no}: Dead stub detected: {line.strip()}")
                except Exception as e:
                    errors.append(f"Failed to read {file_path}: {e}")

    return errors


def check_empty_catch_blocks():
    """Verify backend code does not contain silent empty catch blocks."""
    errors = []
    empty_catch_pattern = re.compile(r"catch\s*\([^)]*\)\s*\{\s*\}")

    backend_src = os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "backend", "src")
    if not os.path.exists(backend_src):
        return errors

    for root, _, files in os.walk(backend_src):
        if "__tests__" in root:
            continue
        for file in files:
            if not file.endswith(".ts"):
                continue
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    matches = list(empty_catch_pattern.finditer(content))
                    if matches:
                        rel_path = os.path.relpath(file_path, REPO_ROOT)
                        errors.append(f"{rel_path}: Found {len(matches)} silent empty catch block(s)")
            except Exception as e:
                errors.append(f"Failed to inspect {file_path}: {e}")

    return errors


def check_shared_contract_sync():
    """Run shared contract check script."""
    errors = []
    sync_script = os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "backend", "scripts", "sync-shared-api.js")
    if os.path.exists(sync_script):
        res = subprocess.run(
            ["node", sync_script, "--check"],
            cwd=os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "backend"),
            capture_output=True,
            text=True
        )
        if res.returncode != 0:
            errors.append(f"Shared contract check failed:\n{res.stdout}\n{res.stderr}")
    return errors


def main():
    print("🌾 Running Agri-Extension Anti-Flop Verification Suite...")
    errors = []

    print("  [1/3] Checking for dead stubs and NotImplementedError placeholders...")
    stub_errs = check_no_dead_stubs()
    if stub_errs:
        errors.extend(stub_errs)
    else:
        print("        PASS: Zero dead stubs found.")

    print("  [2/3] Checking for silent empty catch blocks...")
    catch_errs = check_empty_catch_blocks()
    if catch_errs:
        errors.extend(catch_errs)
    else:
        print("        PASS: No silent empty catch blocks found.")

    print("  [3/3] Checking shared contracts sync...")
    sync_errs = check_shared_contract_sync()
    if sync_errs:
        errors.extend(sync_errs)
    else:
        print("        PASS: Shared contracts in sync.")

    if errors:
        print("\n❌ Anti-Flop Violations Detected:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print("\n✅ All Anti-Flop checks passed successfully.")
    sys.exit(0)


if __name__ == "__main__":
    main()
