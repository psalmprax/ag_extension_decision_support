# Rotating Server IPs & GitHub Secrets

**Audience:** Operators rotating the staging or production server host.

> **The most common operator mistake** in our deploy pipeline: grepping `.github/workflows/*.yml` for the server IP. The IP **does not live in the workflow files** — it lives in **GitHub Secrets** and resolves at runtime.

---

## 1. Mental Model

The deploy pipelines (`deploy-stage.yml` + `deploy-all.yml`) use `appleboy/ssh-action` to open SSH connections to the deploy targets. That action needs a host IP at runtime, but the IP **cannot live in committed workflow YAML**:

- Server IPs change: reboots, VPS swaps, hosting-provider moves.
- IPs in committed code would turn every rotation into a code-review + git-log event.
- Open-source repos would leak infrastructure layout.

So every workflow references a **GitHub Secret** instead:

```
[Workflow YAML]
    host: ${{ secrets.TEST_SERVER_IP }}
                ↓
  [Repo → Settings → Secrets → Actions → TEST_SERVER_IP]
                ↓
  Resolves at runtime to the actual IP (e.g. 161.97.126.84)
                ↓
  [appleboy/ssh-action] → opens the SSH connection.
```

If you grep `.github/workflows/*.yml` looking for the IP, you will **only** find `${{ secrets.* }}` references.

---

## 2. Where IPs Actually Live

| Location | Form | Functional? |
|---|---|---|
| **GitHub Actions Secrets — staging** | `TEST_SERVER_IP` | ✅ YES — drives SSH |
| **GitHub Actions Secrets — production** | `PROD_SERVER_IP` | ✅ YES — drives SSH |
| `.github/workflows/deploy-stage.yml` line 8 | `# - TEST_SERVER_IP : the server IP (currently 161.97.126.84)` | ❌ NO — *documentation comment only* |
| `.github/workflows/deploy-*.yml` `host:` lines | `${{ secrets.TEST_SERVER_IP }}` or `${{ secrets.PROD_SERVER_IP }}` | ✅ YES — resolved at runtime |

The single hardcoded-looking literal (`161.97.126.84` on line 8 of `deploy-stage.yml`) is **a comment** that documents the current Secret value for readers. The workflow itself does not consume it.

---

## 3. How to Rotate (Step by Step)

### A. Rotate `TEST_SERVER_IP` (testing / staging)

1. **Update the GitHub Secret** — this is the functional step:

   - Repo → **Settings** → **Secrets and variables** → **Actions**.
   - Click `TEST_SERVER_IP` → **Update secret** → enter the new IP → **Update secret**.

2. **Sync the documentation comment** in `.github/workflows/deploy-stage.yml` line 8 so it stays in lock-step with the Secret. From the repo root:

   ```bash
   OLD_IP="161.97.126.84"          # ← current GitHub Secret value (look up in repo Settings → Secrets)
   NEW_IP="1.2.3.4"                # ← the new staging-host IP
   # Escape dots so the regex still matches literal `.` even next to similar-looking characters
   # (raw `.` would also match letters / digits / `-` / `_` in adjacent text):
   OLD_ESC=$(printf '%s' "$OLD_IP" | sed 's/\./\\./g')
   # Linux / WSL / GitHub Bash only (BSD/macOS sed needs `-i ''`):
   sed -i "s/currently ${OLD_ESC}/currently ${NEW_IP}/" \
       .github/workflows/deploy-stage.yml
   git add .github/workflows/deploy-stage.yml
   # Replace <NEW_IP_TAG> below with the same IP you set NEW_IP to:
   git commit -m "docs(stage): sync line-8 TEST_SERVER_IP comment to ${NEW_IP}"
   git push origin stage
   ```

3. **Verify** — push any commit to `stage` (or `workflow_dispatch` the stage workflow manually). A clean deploy-stage run means the new IP is wired through. (Requires repo **write** permission to trigger `workflow_dispatch`.)

### B. Rotate `PROD_SERVER_IP`

Same flow, but:

- GitHub Secret name is `PROD_SERVER_IP` (not `TEST_SERVER_IP`).
- There is **no comment to sync** in `deploy-all.yml` (no `currently X.X.X.X` line).
- **Verify** — merge a small PR to `master`, or `workflow_dispatch` `deploy-all.yml` with `force_clean_rebuild=true`. Confirm the run lands cleanly end-to-end. (Requires repo **write** permission to trigger `workflow_dispatch`.)

### C. Mistakes to Avoid

- ❌ **Editing line 8 of `deploy-stage.yml` *only*** — updates the comment, not the deploy target. The action will still SSH to the old IP.
- ❌ **Committing the line-8 comment change *before* updating the GitHub Secret** — leaves comment and Secret out of sync.
- ❌ **Skipping the commit/push** after updating the Secret — the comment on line 8 will drift and mislead the next reader.

---

## 4. Related Docs

- `docs/DEPLOY_WORKFLOW.md` — full CI/CD workflow reference (job / step matrix + secrets table).
- `ag-extension-dashboard/DEPLOYMENT.md` — older infra overview (Traefik + DB migration; 119 lines).
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` — comprehensive production hardening (823 lines).
