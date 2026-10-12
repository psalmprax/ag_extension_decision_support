# Backend PCRE2 Remediation Verification

## Change

The shared `node-base` stage now refreshes APT metadata and explicitly installs
`libpcre2-8-0`, upgrading the inherited Debian package before downstream backend
stages are built. Package lists are removed in the same layer. No vulnerability
ignores, CI failure thresholds, Node/npm pins, entrypoints, or application
dependencies were changed.

## Verification On 2026-10-04

- The new regression assertion failed before the Dockerfile change and passed
  afterward. All 11 deployment-configuration tests passed.
- A fresh `node-base` build with `--pull --no-cache` succeeded.
- `dpkg-query` reported PCRE2 `10.42-1+deb12u2`; Debian's version comparison
  confirmed it meets the reported fixed version.
- A fresh production image build succeeded, including backend TypeScript
  compilation. The production image also reported `10.42-1+deb12u2`.
- A subsequent production rebuild and structured Trivy scan succeeded for
  `ag-ext-backend:pcre2-scan` on Debian 12.15. With HIGH/CRITICAL severity,
  `--exit-code 1`, `--ignore-unfixed`, and the existing ignore file, the scan
  reported zero vulnerability findings and zero secret findings.
- Scanner cache and temporary files used an isolated memory-backed directory
  because the first database download exhausted the root filesystem. No shared
  Docker cache, images, volumes, or unrelated files were pruned by this task.

## Test Gate Limitation

The repository-required `scripts/agent-helper.sh test-all` stops at backend
tests because the local `jest` executable is unavailable. Unrelated dependency
installation was not added to this patch. Editor Dockerfile diagnostics also
flag multiple CMD entries across distinct stages; actual Docker builds succeed.

No running services were restarted and no changes were committed or pushed.
The CI pipeline must rebuild its image from the changed Dockerfile before its
scan can reflect this remediation.