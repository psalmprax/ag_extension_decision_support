#!/usr/bin/env python3
"""Anti-Hallucination Verification Suite for Agri-Extension Decision Support System.
Enforces epistemic grounding, documentation link validity, and schema/dependency alignment.
"""
import ast
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def check_docs_link_grounding():
    """Verify that file:/// links in markdown protocols point to real existing files."""
    errors = []
    file_link_pattern = re.compile(r"\[([^\]]+)\]\(file://(/[^#\)]+)(?:#[^\)]*)?\)")

    target_docs = [
        os.path.join(REPO_ROOT, "anti_flop.md"),
        os.path.join(REPO_ROOT, "anti_hullicination.md"),
        os.path.join(REPO_ROOT, "CLAUDE.md"),
        os.path.join(REPO_ROOT, "KARPATHY_RULES.md"),
    ]

    for doc in target_docs:
        if not os.path.exists(doc):
            continue
        with open(doc, "r", encoding="utf-8") as f:
            content = f.read()
        for label, file_path in file_link_pattern.findall(content):
            if not os.path.exists(file_path):
                rel_doc = os.path.relpath(doc, REPO_ROOT)
                errors.append(f"{rel_doc}: Broken file reference: [{label}](file://{file_path})")

    return errors


def check_prisma_schema_grounding():
    """Verify critical models and tables exist in prisma schema."""
    errors = []
    schema_path = os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "backend", "prisma", "schema.prisma")
    if not os.path.exists(schema_path):
        return [f"Missing canonical Prisma schema at {schema_path}"]

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_content = f.read()

    expected_models = ["User", "LoginHistory"]
    for model in expected_models:
        if f"model {model}" not in schema_content and f"model {model.lower()}" not in schema_content:
            errors.append(f"schema.prisma missing expected sovereign model: {model}")

    return errors


def check_agent_imports_grounding():
    """Verify Python agent tools do not import uninstalled/hallucinated third-party libraries."""
    errors = []
    req_file = os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "agents", "requirements.txt")
    if not os.path.exists(req_file):
        return [f"Missing requirements.txt at {req_file}"]

    declared_deps = set()
    with open(req_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            pkg = re.split(r"[><=~\[]", line)[0].strip().lower().replace("-", "_")
            declared_deps.add(pkg)

    # Python standard library modules
    stdlib_modules = getattr(sys, "stdlib_module_names", set())

    # Common package mapping aliases (e.g. pyjwt -> jwt)
    pkg_aliases = {
        "pyjwt": "jwt",
        "python_dateutil": "dateutil",
        "python_dotenv": "dotenv",
        "python_json_logger": "pythonjsonlogger",
        "langchain_openai": "langchain_openai",
        "psycopg2_binary": "psycopg2",
    }

    agents_dir = os.path.join(REPO_ROOT, "ag-extension-dashboard", "src", "agents")
    for root, _, files in os.walk(agents_dir):
        if "__pycache__" in root or ".pytest_cache" in root:
            continue
        # Collect local .py files in current directory to allow local sibling imports
        local_py_modules = {os.path.splitext(f)[0].lower() for f in files if f.endswith(".py")}

        for file in files:
            if not file.endswith(".py"):
                continue
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read(), filename=file_path)
                for node in ast.walk(tree):
                    top_name = None
                    if isinstance(node, ast.Import):
                        for n in node.names:
                            top_name = n.name.split(".")[0].lower()
                    elif isinstance(node, ast.ImportFrom) and node.module:
                        top_name = node.module.split(".")[0].lower()

                    if not top_name:
                        continue

                    # Allow stdlib, declared deps, local sibling modules, or top-level agent packages
                    if (
                        top_name in stdlib_modules
                        or top_name in declared_deps
                        or top_name in local_py_modules
                        or top_name in {"tools", "cloakbrowser", "crew_main", "main", "config", "shared"}
                    ):
                        continue

                    # Check aliases
                    matched = False
                    for dep, alias in pkg_aliases.items():
                        if dep in declared_deps and top_name == alias:
                            matched = True
                            break
                    if not matched:
                        rel_path = os.path.relpath(file_path, REPO_ROOT)
                        errors.append(f"{rel_path}:{node.lineno}: Hallucinated import '{top_name}' not found in requirements.txt")
            except Exception as e:
                errors.append(f"Failed to parse {file_path}: {e}")

    return errors


def main():
    print("🔍 Running Agri-Extension Anti-Hallucination Verification Suite...")
    errors = []

    print("  [1/3] Validating documentation link grounding...")
    link_errs = check_docs_link_grounding()
    if link_errs:
        errors.extend(link_errs)
    else:
        print("        PASS: All referenced file links exist on disk.")

    print("  [2/3] Checking Prisma canonical schema grounding...")
    schema_errs = check_prisma_schema_grounding()
    if schema_errs:
        errors.extend(schema_errs)
    else:
        print("        PASS: Canonical database models verified in schema.prisma.")

    print("  [3/3] Checking agent dependency & import grounding...")
    import_errs = check_agent_imports_grounding()
    if import_errs:
        errors.extend(import_errs)
    else:
        print("        PASS: Agent Python imports grounded in requirements.txt / stdlib.")

    if errors:
        print("\n❌ Anti-Hallucination Violations Detected:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print("\n✅ All Anti-Hallucination checks passed successfully.")
    sys.exit(0)


if __name__ == "__main__":
    main()
