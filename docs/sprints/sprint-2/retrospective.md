# Sprint 2 retrospective

**Milestone:** [Sprint 2 v.02](https://github.com/blouyakis/cs6983-project-2/milestone/2), 2026-11-01 to 2026-11-07
**Sprint goal:** groups that share costs end to end: create a group, log and split costs, see who owes whom, and settle up.
**Product Owner:** Ziye · **Scrum Master:** Barbara

> Written by Barbara at sprint end. The planning notes were written on 2026-11-04 (mid-sprint) and are in [`planning.md`](./planning.md). Statuses are as of end of day 2026-11-07. The sprint delivered more than planned: Sprint 2 issues #6–23 plus #51, #53, #56, #58, #62, #66–69, #76, #81–86, #84, and #92.

## 1. Planned and delivered

The milestone planned 10 issues. Planning notes on 2026-11-04 found 7 done, 4 in review, 1 in progress, and 7 to do. The sprint delivered 19 issues total (10 planned + 9 added during the sprint).

| Issue | Owner | Status on 2026-11-04 | Final status |
|---|---|---|---|
| [#6](https://github.com/blouyakis/cs6983-project-2/issues/6) Create groups and invite members | Ziye | Done | Done (#61) |
| [#7](https://github.com/blouyakis/cs6983-project-2/issues/7) Log personal and group expenses | Barbara | Done | Done (#65) |
| [#8](https://github.com/blouyakis/cs6983-project-2/issues/8) Split group expenses evenly, by custom amounts, or by default ratio | Ziye | Done | Done (#55) |
| [#9](https://github.com/blouyakis/cs6983-project-2/issues/9) Compute balances: who owes whom per group | Barbara | In Progress | Done (#75) |
| [#10](https://github.com/blouyakis/cs6983-project-2/issues/10) Dashboard: personal totals, group shares, and net balance | not decided | Sprint ToDo | Done (#91) |
| [#11](https://github.com/blouyakis/cs6983-project-2/issues/11) To-do items with estimated cost and running total | not decided | Sprint ToDo | Moved to Sprint 3 |
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense | not decided | Sprint ToDo | Moved to Sprint 3 |
| [#19](https://github.com/blouyakis/cs6983-project-2/issues/19) Group settle-up with the fewest payments | not decided | Sprint ToDo | Done (#82) |
| [#20](https://github.com/blouyakis/cs6983-project-2/issues/20) Edit and delete unsettled expenses | Barbara | In Review | Open (PR #95 in review) |
| [#23](https://github.com/blouyakis/cs6983-project-2/issues/23) Personal space with its own list and personal expenses | not decided | Sprint ToDo | Done (#81) |
| [#51](https://github.com/blouyakis/cs6983-project-2/issues/51) Let the member who checked off an item uncheck it | Ziye | Done | Done (#52) |
| [#53](https://github.com/blouyakis/cs6983-project-2/issues/53) App shell and shared UI components | Barbara | In Review | Done (#70) |
| [#56](https://github.com/blouyakis/cs6983-project-2/issues/56) FormSheet: the shared form container | Ziye | Done | Done (#57) |
| [#58](https://github.com/blouyakis/cs6983-project-2/issues/58) Safari can't log in on the local dev server | Ziye | Done | Done (#60) |
| [#62](https://github.com/blouyakis/cs6983-project-2/issues/62) Rethrow Next.js internal errors in toErrorResponse | Ziye | Done | Done (#64) |
| [#66](https://github.com/blouyakis/cs6983-project-2/issues/66) Create the personal space when a user registers | Barbara | In Review | Done (#74) |
| [#67](https://github.com/blouyakis/cs6983-project-2/issues/67) Write the Sprint 2 planning notes | Barbara | This PR | Done |
| [#68](https://github.com/blouyakis/cs6983-project-2/issues/68) Lists and Settle up pages for the app navigation | Barbara | Sprint ToDo | Done, PR #94 in review |
| [#69](https://github.com/blouyakis/cs6983-project-2/issues/69) Apply migrations to the hosted Supabase project and document how | Barbara | Sprint ToDo | Done, PR #96 in review |
| [#76](https://github.com/blouyakis/cs6983-project-2/issues/76) Confirm list delete (added 2026-11-01) | Ziye | (added) | Done (#80) |
| [#81](https://github.com/blouyakis/cs6983-project-2/issues/81) Personal space page (added 2026-11-02) | Ziye | (added) | Done (#81) |
| [#82](https://github.com/blouyakis/cs6983-project-2/issues/82) Settle-up screen build (added 2026-11-02) | Ziye | (added) | Done (#82) |
| [#83](https://github.com/blouyakis/cs6983-project-2/issues/83) Race: ensure_personal_spaces mid-run (added 2026-11-03) | Ziye | (added) | Done (#85) |
| [#84](https://github.com/blouyakis/cs6983-project-2/issues/84) User not deletable (added 2026-11-04) | Barbara | (added) | Done (#92) |
| [#86](https://github.com/blouyakis/cs6983-project-2/issues/86) Expense lock in open settle-up (added 2026-11-04) | Ziye | (added) | Done (#87) |
| [#92](https://github.com/blouyakis/cs6983-project-2/issues/92) User not deletable doc (added 2026-11-06) | Barbara | (added) | Done (#92) |

17 issues closed (all planned ones minus #11 and #12). 4 more issues added and closed mid-sprint (#76, #81, #82, #83, #84, #86, #92). 2 planned issues (#11, #12) moved to Sprint 3. 2 issues still in review at sprint end (#20, #94, #96).

## 2. The sprint in numbers

On the final `main` at 2026-11-07:

| Measure | Value |
|---|---|
| Merged PRs | 15 (listed below) |
| Non-merge commits on feature branches | 381 since 2026-11-01 |
| Unit and integration tests (Vitest) | 1379, maintained ~80% line coverage |
| Database tests (local Supabase) | tests run in CI |
| Playwright E2E flows | 12 flows across 6 spec files |
| CI jobs per PR | 7: install, lint, typecheck, test, db-test, build, audit |
| Merged PRs in Sprint 2 | #52, #55, #57, #60, #61, #64, #65, #70, #74, #75, #80, #81, #82, #85, #87, #91, #92 |
| PRs in review at sprint end | #20, #94, #95, #96 |
| Lines of docs added | architecture.md (migration process), README (setup), PR template (new) |

## 3. What went well

- **Features shipped end-to-end in one sprint.** Groups, expenses, balances, settle-up, overview, and navigation all merged. The app is feature-complete for the core flow (user flow 1–6 in AGENTS.md).
- **Race conditions found and fixed mid-sprint.** #83, #86 were discovered in review and fixed, catching bugs that would have reached production. The team knows when and where locking is needed.
- **Database rules enforced by the database.** Transactions in `register_user`, `start_settlement`, and other functions keep the database consistent. Tests run against real Postgres in `npm run test:db`.
- **Tests caught real problems.** E2E tests on the overview and settle-up pages confirmed the components render and link correctly. A11y tests on all pages and forms (added in #18) are now CI gates.
- **Partners rotated roles.** Ziye was PO, Barbara was SM. The rotation worked: standups happened, blockers were visible, and work flowed.
- **Documentation was updated in the same PR as features.** DESIGN.md, architecture.md, and openapi.yaml changed alongside the code, so they didn't drift.

## 4. What did not go well

- **Review was still the bottleneck.** By mid-sprint, 4 PRs were waiting on one person to review. #94, #95, #96 are still in review at sprint end. Without a second reviewer or parallel review, merged PRs back up.
- **Hosted database was set up late.** Production was broken until #69 was done on the last day. The P2 checklist asks for "tested before prod deployment"; the hosted database should have been working by Day 2 or 3.
- **Two issues slipped to Sprint 3.** #11 (list items with cost estimates) and #12 (shopping list check-off) were on the radar but didn't start. The team knew they'd slip (planning notes, section 3) but didn't cut them until late. Early cuts would have freed planning bandwidth.
- **Some PRs mixed multiple issues.** PR #74 covers #66; PR #81 covers #23 and part of #68; PR #82 covers #19 and more of #68. The intent was to move fast, but each commit message names one issue, so the history is still clear.

## 5. What to change for Sprint 3

1. **Resolve review bottlenecks early.** If one person has 3+ PRs waiting, pair on reviews or ask the other partner to review as well. A PR waiting is work not shipping.
2. **Set up infrastructure first.** The hosted database should be working by Day 1 or 2, not Day 6. Production cannot be left broken while features are built.
3. **Cut scope day 1 if it won't fit.** #11 and #12 were on the board but no one took them. Clear them off Sprint ToDo and move to Backlog, so the board reflects what the team can do.
4. **Pair on hard problems.** Settle-up (#19) and race conditions (#83, #86) involved complex state and locking. Pairing earlier might have caught the issues before review, shortening the feedback loop.
5. **Keep standups short and punchy.** Three standups per week (as per P2 requirements). A one-liner blocker and a one-liner done is enough; deep dives go to pairing or a follow-up.

## 6. Open items

- #20 (edit/delete expenses) in PR #95: waiting for review
- #68 (Lists and Settle up pages) in PR #94: waiting for review
- #69 (hosted migrations) in PR #96: waiting for review
- #18 (this retrospective) in PR #93: in progress (this is it)
