# Backend Base-Image Security Remediation Plan

## Finding And Local Hypothesis

The supplied Trivy report detects eight HIGH/CRITICAL findings in the backend
image. It reports CVE-2026-103111 in Debian's `libpcre2-8-0` (installed
`10.42-1+deb12u1`, fixed `10.42-1+deb12u2`) and seven findings associated
with the Perl runtime packages, reported as `perl-base` (installed
`5.36.0-7+deb12u3`, fixed `5.36.0-7+deb12u4`). The Perl findings include
Perl regular-expression processing, Archive::Tar path traversal and file
modification, IO::Compress code execution, and Storable deserialization.

The backend Dockerfile inherits `node:22-slim`. Its shared `node-base` stage
explicitly installs PCRE2, but does not request a Perl runtime upgrade. The
reported PCRE2 version may also indicate that the failed workflow scanned a
commit/image built before the existing PCRE2 fix. Confirm the run's commit SHA
against `2fec00e0` before attributing that finding to the current Dockerfile.
After refreshing APT metadata, explicitly upgrading the affected PCRE2 and Perl
runtime packages in `node-base` should provide patched packages to all downstream
backend stages. Identify the complete installed Perl package set associated with
the findings so the fix covers Archive::Tar and IO::Compress as well as
`perl-base`.

## Implementation Scope

- Modify only `ag-extension-dashboard/src/backend/Dockerfile` production
   configuration: refresh APT metadata, explicitly upgrade the affected PCRE2
   and Perl runtime packages from the configured Debian repositories in the
   shared `node-base` stage, and remove APT lists in the same layer.
- Preserve the Node major version, npm pin, existing runtime dependencies,
  non-root user, entrypoint, and build targets.
- Add a focused Dockerfile regression assertion to an existing suitable
  container-configuration test, or an isolated backend-image test if none exists.
- Record verification results in backend-local `walkthrough.md`.
- Do not change the frontend, assistant, Trivy severity/exit settings, ignore
  lists, deployment services, or application dependencies.

## Verification

1. Confirm whether the failing workflow run used commit `2fec00e0` or a later
   commit; an older run cannot verify the existing PCRE2 remediation.
2. Run the focused regression check immediately after the first implementation
   edit; it must check that package upgrades occur in the inherited base stage
   and that package metadata is cleaned in the same layer.
3. Build the `node-base` target with `--pull --no-cache`. Query the installed
   PCRE2 and Perl package versions inside the image and use Debian version
   comparison to verify the candidates include at least
   `10.42-1+deb12u2` and `5.36.0-7+deb12u4`, respectively, for the reported
   Debian 12 image.
4. Rebuild the full `production` target with fresh base/package layers and rerun
   Trivy with the existing HIGH/CRITICAL failure policy. Confirm that all eight
   reported findings are gone; a newer package version alone is not sufficient
   evidence that the full scan passes.
5. Run relevant existing configuration tests and the repository-required test
   helper. Report unavailable Docker/Trivy tooling or unrelated test failures;
   do not expand the patch to fix them.
6. Review the diff for unintended changes and report scan/build limitations.

## Risks And Approval

The configured Debian repositories must offer patched PCRE2 and Perl packages.
If they do not, the version check will disconfirm this remediation and require a
separately reviewed base-image or repository change rather than suppressing the
findings.

The VEX notice and scanner-version notice are informational, not the failing
condition. No exploitability exemption is assumed.

Implementation awaits approval of this written plan.