#!/usr/bin/env python3
"""Per-job + per-step diagnosis for the latest run of each relevant workflow.
Token silently extracted from `git remote get-url origin`. Never prints token.
"""
import json
import re
import subprocess
import sys
import urllib.request
import urllib.error

REPO = "psalmprax/ag_extension_decision_support"
API  = f"https://api.github.com/repos/{REPO}"

def extract_token():
    try:
        out = subprocess.check_output(
            ["git", "remote", "get-url", "origin"],
            cwd="/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support",
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return None
    m = re.search(r"x-access-token:([^@]+)@", out)
    return m.group(1) if m else None

def gh(path, token):
    req = urllib.request.Request(
        f"{API}{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            **({"Authorization": f"token {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="ignore")[:500]
    except Exception as e:
        return -1, str(e)

WORKFLOWS = ["ci-cd.yml", "deploy-stage.yml", "deploy-all.yml"]
def main():
    tok = extract_token()
    for wf in WORKFLOWS:
        s, runs = gh(f"/actions/workflows/{wf}/runs?per_page=1", tok)
        if not isinstance(runs, dict) or "workflow_runs" not in runs:
            print(f"### {wf}: HTTP {s} -> {str(runs)[:300]}")
            continue
        if not runs["workflow_runs"]:
            print(f"### {wf}: NO RUNS")
            continue
        r = runs["workflow_runs"][0]
        rid = r["id"]
        print(f"### {wf}  run_id={rid}  status={r['status']}  conclusion={r['conclusion']}"
              f"  sha={(r['head_sha'] or '')[:10]}  started={r['created_at']}  url={r['html_url']}")

        sj, jobs = gh(f"/actions/runs/{rid}/jobs?per_page=20", tok)
        if not isinstance(jobs, dict) or "jobs" not in jobs:
            print(f"  jobs: HTTP {sj} -> {str(jobs)[:300]}")
            continue
        # Sort jobs by started_at
        jobs_list = sorted(jobs["jobs"], key=lambda j: j.get("started_at") or "")
        for j in jobs_list:
            print(f"  job: name={j.get('name')!r:<40}  status={j.get('status')}  "
                  f"conclusion={j.get('conclusion')}  runner={j.get('runner_name')}")
            steps = j.get("steps") or []
            for st in steps:
                num = st.get("number")
                name = st.get("name")
                st_status = st.get("status")
                st_conc = st.get("conclusion")
                marker = ""
                if st_conc == "failure":
                    marker = "  <-- FAILED"
                elif st_conc == "skipped":
                    marker = "  (skipped)"
                print(f"    step[{num}] {name!r:<50}  status={st_status}  conclusion={st_conc}{marker}")
        print()

if __name__ == "__main__":
    main()
