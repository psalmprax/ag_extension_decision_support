# Backend PCRE2 Security Remediation Plan

## Finding And Local Hypothesis

The supplied Trivy report detects CVE-2026-103111 in Debian's `libpcre2-8-0`:
installed `10.42-1+deb12u1`, fixed `10.42-1+deb12u2`.

The backend Dockerfile inherits `node:22-slim`. Its package installation commands
do not explicitly request an upgrade of inherited PCRE2. Installing unrelated
packages does not guarantee that this inherited library is upgraded. Explicitly
installing PCRE2 from refreshed Debian repositories in `node-base` should select
the available patched candidate for all downstream backend stages.

## Implementation Scope

- Modify only `ag-extension-dashboard/src/backend/Dockerfile` production
  configuration: refresh APT metadata, explicitly install `libpcre2-8-0` with
  `--no-install-recommends` in the shared `node-base` stage, and remove APT lists
  in the same layer.
- Preserve the Node major version, npm pin, existing runtime dependencies,
  non-root user, entrypoint, and build targets.
- Add a focused Dockerfile regression assertion to an existing suitable
  container-configuration test, or an isolated backend-image test if none exists.
- Record verification results in backend-local `walkthrough.md`.
- Do not change the frontend, assistant, Trivy severity/exit settings, ignore
  lists, deployment services, or application dependencies.

## Verification

1. Run the focused regression check immediately after the first implementation
   edit; it must check that the upgrade occurs in the inherited base stage and
   that package metadata is cleaned in the same layer.
2. Build the `node-base` target with `--pull --no-cache`. Query PCRE2 inside the
   image and use Debian version comparison to verify it is at least
   `10.42-1+deb12u2` for the reported Debian 12 image.
3. Rebuild the full `production` target with fresh base/package layers and rerun
   Trivy with the existing HIGH/CRITICAL failure policy. A newer package version
   alone is not sufficient evidence that the full scan passes.
4. Run relevant existing configuration tests and the repository-required test
   helper. Report unavailable Docker/Trivy tooling or unrelated test failures;
   do not expand the patch to fix them.
5. Review the diff for unintended changes and report scan/build limitations.

## Risks And Approval

The configured Debian repositories must offer the patched package. If they do
not, the version check will disconfirm this remediation and require a separately
reviewed base-image or repository change rather than suppressing the finding.

The VEX notice and scanner-version notice are informational, not the failing
condition. No exploitability exemption is assumed.

Implementation awaits approval of this written plan.