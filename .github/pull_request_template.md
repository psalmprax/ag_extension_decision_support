## Summary

<!-- Describe the purpose and user-visible impact of this change. -->

## Validation

- [ ] I reviewed the [CI/CD Q&A playlist](../docs/CICD_QA_PLAYLIST.md) relevant to this change.
- [ ] I ran the applicable lint checks.
- [ ] I ran the applicable typechecks and builds.
- [ ] I ran the applicable backend and frontend tests.
- [ ] I ran `git diff --check`.
- [ ] I ran or reviewed the applicable Fallow regression checks.
- [ ] I ran or reviewed the applicable security checks.

## Deployment readiness

- [ ] This change does not expose secrets, tokens, credentials, or sensitive personal data.
- [ ] Database or migration impact is documented and verified.
- [ ] Required environment variables and provider configuration are documented.
- [ ] Health/readiness and smoke-test impact is understood.
- [ ] Failure, unavailable, queued, and rollback behavior is explicit where applicable.
- [ ] Docker Compose, network, cache, Buildx, or deployment changes follow the repository deployment rules.
- [ ] I confirmed the deployed behavior will not claim success for work that is only queued, simulated, estimated, or unavailable.

## Evidence

<!-- Include commands run, relevant workflow links, screenshots, or test evidence. -->

## Notes for reviewers

<!-- Call out risks, rollout requirements, migration details, or known inherited quality findings. -->
