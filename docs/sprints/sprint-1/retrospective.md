# Sprint 1 retrospective

**Milestone:** [Sprint 1 v.01](https://github.com/blouyakis/cs6983-project-2/milestone/1), 2026-10-25 to 2026-10-31
**Sprint goal:** a deployed foundation: the app scaffold, CI/CD, the database, accounts, and access control.

> Draft prepared from the issue, pull request and commit history by Barbara. Every number and PR below can be checked on GitHub. The "What to change" items are proposals for the team to confirm or edit at Sprint 2 planning.

## 1. Planned and delivered

All five issues planned on 2026-10-25 were closed. Two chores were added during the sprint and closed too, and #47 is the end-of-sprint documentation update.

| Issue | Owner | Pull requests | Result |
|---|---|---|---|
| [#1](https://github.com/blouyakis/cs6983-project-2/issues/1) Scaffold Next.js, Tailwind, linting and test runners | Ziye | #25 | Done |
| [#2](https://github.com/blouyakis/cs6983-project-2/issues/2) CI pipeline with deploy previews | Ziye | #26 | Done |
| [#3](https://github.com/blouyakis/cs6983-project-2/issues/3) Database schema and connection | Ziye | #32, #35, #37, #38, #39, #40, #41, #43 | Done |
| [#4](https://github.com/blouyakis/cs6983-project-2/issues/4) Registration and login with JWT | Barbara | #42 | Done |
| [#5](https://github.com/blouyakis/cs6983-project-2/issues/5) Protect routes and scope data to group membership | Barbara | #44 | Done |
| [#31](https://github.com/blouyakis/cs6983-project-2/issues/31) CLAUDE.md loads AGENTS.md (added 2026-10-30) | Barbara | #33 | Done |
| [#45](https://github.com/blouyakis/cs6983-project-2/issues/45) Move to Node 26, the LTS release (added 2026-10-30) | Barbara | #46 | Done |
| [#47](https://github.com/blouyakis/cs6983-project-2/issues/47) README, AGENTS.md and sprint docs up to date (added 2026-10-31) | Barbara | this pull request | In review |

Documentation pull requests outside an issue: #24 (the first AGENTS.md, DESIGN.md and planning docs), #28, #29, #30, #34 and #36 (README, design, and the AGENTS.md "why" notes).

## 2. The sprint in numbers

On `main` after the last merge (`5dc2f1a`):

| Measure | Value |
|---|---|
| Merged pull requests | 20 |
| Non-merge commits | 107 (Ziye 62, Barbara 45) |
| Unit and integration tests (Vitest) | 148, with 99.27% line coverage (the target is 80%) |
| Database tests (local Supabase) | 98 |
| Playwright flows | 6 |
| CI jobs per pull request | 7: install, lint, typecheck, test, db-test, build, audit |
| Tables with Row Level Security and no policies | 8 of 8 |
| Test commits before code, for #3, #4 and #5 | 28 test commits and 25 feature commits, each rule's test first |
| Production | <https://cs6983-project-2.vercel.app>, deployed from `main` |

Pull request reviews: 17 of the 20 merged pull requests have an approval from the other partner. #24 (the planning docs) has none, and #35 and #37 have none because #38 brought the users table onto `main` with an approval.

## 3. What went well

- **Rules were tested, then changed.** The before/after test of AGENTS.md on #4 ([`docs/sprints/issue-4-comparison.md`](../issue-4-comparison.md)) found 14 deviations without the rules and none with them. It led to four AGENTS.md edits, each recorded in the Changelog with the reason.
- **Database rules are enforced by the database and tested there.** The member cap, the shares-add-up check and the access rules run against a real Postgres in `npm run test:db`. In #40 the cap's race between two joins failed in 6 of 10 runs without the row lock and passed 20 of 20 with it.
- **Reviews caught real problems.** #40 replaced an edit made to an already merged migration with new migrations, and #41 collected the fixes from the #32 and #35 reviews.
- **Every issue ended with green CI and a live deploy.** The Vercel preview and production deploys worked from the first pull request.
- **Test-first history is visible.** The git history for #3, #4 and #5 shows a failing test commit before each piece of code.

## 4. What did not go well

- **#3 took eight pull requests, and some were stacked on other branches.** #35 and #37 were not approved, and #38 then had to bring the users table onto `main`. #3 only closed on the last day of the sprint.
- **Acceptance criteria were not ticked when issues closed.** #3, #4, #5 and #45 were closed with empty checkboxes and ticked afterwards, during the end-of-sprint review.
- **Documentation went stale.** The README still described the empty scaffold, and the AGENTS.md folder tree marked files as planned after they existed. #47 fixes both.
- **A few process slips.** Commit `d7514a6` has a literal `(#N)` instead of an issue number, #42 is titled "Feature/4 auth", and some early documentation commits have no issue number. Merged history can't be changed, so only the habit can.
- **`db-test` is not a required status check on `main`.** The ruleset requires six checks, and the README lists seven. A pull request with failing database tests could be merged.

## 5. What to change in Sprint 2

Sprint 2 ([milestone](https://github.com/blouyakis/cs6983-project-2/milestone/2), due 2026-11-07) holds ten issues: #6, #7, #8, #9, #10, #11, #12, #19, #20 and #23. Sprint 1 delivered five planned issues and two chores.

1. **Tick the acceptance criteria in the pull request that closes the issue**, and list them in the PR body so the reviewer can check each one.
2. **Update the README status and AGENTS.md folder tree in the feature PR that changes them**, instead of at the end of the sprint.
3. **Add `db-test` to the required checks** in the `main` ruleset (a repository admin setting).
4. **One issue, one branch, one pull request where possible.** Split an issue first if it needs several. Avoid stacking branches on each other.
5. **Pull request titles follow the commit convention** with the issue number, for example `feat(groups): create groups (#6)`.
6. **Plan the sprint on the board.** Move the Sprint 2 issues from Backlog to Sprint ToDo, and check the load: ten issues, including settle-up (#19), is a lot for one week. Consider moving some to Sprint 3.
7. **Wire registration to `register_user`.** Ziye plans to switch the register service from a direct insert to the `register_user` function, which also creates the personal space. Track it in its own issue, separate from #23.

## 6. Open items

- The communication log link is not in the README yet ([#47](https://github.com/blouyakis/cs6983-project-2/issues/47)).
- The Sprint 2 planning notes are not written yet.
