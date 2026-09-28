---
name: Bug report
about: Something LeaveFlow does differently from what it should
title: "[Bug] "
labels: bug
---

<!-- Title: what is wrong, where — e.g. "[Bug] Cancelling an approved request returns 200 instead of 409" -->

**Test case:** <!-- e.g. TC-15 from docs/test-cases.md, or "exploratory" -->

## Steps to reproduce
1.
2.
3.

## Expected
<!-- What should happen, and where that is written down (user story, docs/api.md, test case) -->

## Actual
<!-- What happened instead. Paste the exact error text / status code. -->

## Evidence
<!-- Screenshot, Thunder Client response, or terminal output -->

## Environment
- Commit: <!-- `git log -1 --oneline` -->
- Browser:
- Where: <!-- local dev / e2e / staging -->

## Severity — how bad is the impact?
- [ ] **S1 Critical** — wrong leave balance or data, security hole, or nobody can use the app
- [ ] **S2 Major** — a must-have feature is broken and there is no workaround
- [ ] **S3 Minor** — broken, but there is a workaround, or it only affects an edge case
- [ ] **S4 Cosmetic** — wording, layout, typo

## Priority — how soon should it be fixed?
- [ ] **P1** — now / before the next demo
- [ ] **P2** — this sprint
- [ ] **P3** — when there is time

<!-- Severity and priority are judged separately: a typo on the page the MD sees tomorrow is S4 but P1. -->
