# Sprint 3 retrospective

**Milestone:** [Sprint 3 v.03](https://github.com/blouyakis/cs6983-project-2/milestone/3), 2026-11-08 to 2026-11-13. The submission deadline later moved to Sunday 2026-11-15 at midnight Pacific.  
**Sprint goal:** finish the Should Haves and ship the final submission: direct payments, the itemized bill, leaving a group, expense history with filters and the default split screen, with the API docs, the end-to-end suite in CI and the demo video.  
**Product Owner:** Barbara · **Scrum Master:** Ziye

> Written by Ziye (Scrum Master) on 2026-11-12 (#103), from the facts Barbara compiled from the planning notes, the milestone and the git and pull request history. Numbers are for `main` at `1b4cdf1`, after #135. Sections 3 to 5 combine both partners' points.

---

## 1. Planned and delivered

Twenty-two issues and 80 points were committed: sixteen at planning (67 points) and six added on 2026-11-08 (13 points). Twenty of them are closed, which is 72 points. The two still open are #102 (5 points) and #103 (3), both submission work due on 2026-11-15. Three more issues came out of reviews after planning, #121, #124 and #130, and all three are done. #54 and #77 were left out at planning and were not done.

The sprint goal was met apart from the demo video, which is recorded and being put together under #102.

| Issue | Owner | Points | Pull requests | Result |
|---|---|---|---|---|
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense (from Sprint 2) | Barbara | 8 | #98 | Done |
| [#89](https://github.com/blouyakis/cs6983-project-2/issues/89) Keep the sidebar's group balances current on client navigation (from Sprint 2) | Ziye | 5 | #109 | Done |
| [#90](https://github.com/blouyakis/cs6983-project-2/issues/90) Load only this month's personal expenses and the open items for the overview (from Sprint 2) | Ziye | 2 | #105 | Done |
| [#14](https://github.com/blouyakis/cs6983-project-2/issues/14) Pay one person directly and confirm it | Ziye | 5 | #107 | Done |
| [#15](https://github.com/blouyakis/cs6983-project-2/issues/15) Expense history with filters by group, person, and date range | Barbara | 8 | #127 | Done |
| [#21](https://github.com/blouyakis/cs6983-project-2/issues/21) Itemized bill for each member | Barbara | 5 | #125 | Done |
| [#22](https://github.com/blouyakis/cs6983-project-2/issues/22) Leave a group with read-only access to past history | Ziye | 5 | #120 | Done |
| [#63](https://github.com/blouyakis/cs6983-project-2/issues/63) Set a group's default split ratio on the group page | Ziye | 8 | #116 | Done |
| [#75](https://github.com/blouyakis/cs6983-project-2/issues/75) Take membership times from the database clock, not the server's | Ziye | 1 | #106 | Done |
| [#16](https://github.com/blouyakis/cs6983-project-2/issues/16) Public API documentation with OpenAPI/Swagger | Ziye | 3 | #133 | Done |
| [#17](https://github.com/blouyakis/cs6983-project-2/issues/17) End-to-end test suite covering the main user flows | Barbara (CI job); both (specs, with each feature) | 5 | #129 | Done |
| [#100](https://github.com/blouyakis/cs6983-project-2/issues/100) Health-check endpoint that shows the app and the database are up | Ziye | 1 | #111 | Done |
| [#101](https://github.com/blouyakis/cs6983-project-2/issues/101) Run lint and format on staged files before each commit (Husky and lint-staged) | Ziye | 1 | #110 | Done |
| [#99](https://github.com/blouyakis/cs6983-project-2/issues/99) Write the Sprint 3 planning notes | Ziye | 2 | #104 | Done |
| [#102](https://github.com/blouyakis/cs6983-project-2/issues/102) Project 2 submission: demo video, reflections and contribution log | Both | 5 | #131 (checklist and Contributors) | In progress |
| [#103](https://github.com/blouyakis/cs6983-project-2/issues/103) Write the Sprint 3 retrospective and bring the final docs up to date | Ziye; Barbara (accessibility checks) | 3 | #135 (accessibility checks), this pull request | In review |
| [#108](https://github.com/blouyakis/cs6983-project-2/issues/108) Let the recipient decline a payment marked paid, so a settle-up can't get stuck (added 2026-11-08) | Ziye | 5 | #117 | Done |
| [#112](https://github.com/blouyakis/cs6983-project-2/issues/112) Don't let a settle-up suggest a payment that a pending direct payment already covers (added 2026-11-08) | Barbara | 3 | #126 | Done |
| [#113](https://github.com/blouyakis/cs6983-project-2/issues/113) update-expense test fails at random: sharesOf returns equal shares in any order (added 2026-11-08) | Ziye | 1 | #118 | Done |
| [#79](https://github.com/blouyakis/cs6983-project-2/issues/79) Database tests fail at random in cleanup with groups_created_by_fkey (added 2026-11-08) | Ziye | 2 | #122 | Done |
| [#114](https://github.com/blouyakis/cs6983-project-2/issues/114) Decide whether previews get their own Supabase project (added 2026-11-08) | Both; Ziye wrote it up | 1 | #128 | Done: previews have no database |
| [#115](https://github.com/blouyakis/cs6983-project-2/issues/115) Say in AGENTS.md that public routes skip the session check (added 2026-11-08) | Ziye | 1 | #119 | Done |
| [#121](https://github.com/blouyakis/cs6983-project-2/issues/121) Take a settle-up payment's paid_at from the database clock, not the server's (found during #79) | Ziye | — | #123 | Done |
| [#124](https://github.com/blouyakis/cs6983-project-2/issues/124) add_member and update_group can deadlock with a payment or cost in the same group (from the review of #116) | Ziye | 3 | #132 | Done |
| [#130](https://github.com/blouyakis/cs6983-project-2/issues/130) Let the expense history filter by a payer who has left the group (from the review of #127) | Barbara | — | #134 | Done |
| [#54](https://github.com/blouyakis/cs6983-project-2/issues/54) Export the filtered expense list as CSV (Could Have) | — | 3 | — | Not done, as planned |
| [#77](https://github.com/blouyakis/cs6983-project-2/issues/77) Use the user's time zone for timestamps, today and this month | — | 5 | — | Not done, as planned |

---

## 2. The sprint in numbers

On `main` at `1b4cdf1`:

| Measure | Value |
|---|---|
| Merged pull requests in Sprint 3 | 25 (Ziye 17, Barbara 8) |
| Partner reviews in Sprint 3 | All 25 merged pull requests were approved by the other partner: Barbara reviewed Ziye's 17, Ziye reviewed Barbara's 8 |
| Partner reviews over the whole project | Barbara 36, Ziye 34 (pull requests reviewed that the reviewer did not author) |
| Merged pull requests over the whole project | 73 |
| Non-merge commits in Sprint 3 | 162 (Ziye 111, Barbara 51) |
| Unit and integration tests (Vitest) | 1,674 tests across 154 test files, 96.6% line coverage, coverage thresholds passing |
| Database tests (local Supabase Postgres) | 337 tests across 41 test files in `supabase/tests/`, as reported in #132 |
| Playwright E2E scenarios | 81 tests across 16 spec files, run in CI against a production build (#129) |
| SQL migrations added in Sprint 3 | 7 (`rejoin_member`, `record_payment`, `leave_group`, `former_member_shares_fixed`, `add_member`, `start_settlement_pending_payments`, `group_lock_no_key_update`) |
| CI required checks | 8: install, lint, typecheck, test, db-test, build, audit, and e2e (added to the ruleset on 2026-11-12) |
| Production deployment | <https://cs6983-project-2.vercel.app>, deployed from `main`; all 28 migrations on the hosted database as of 2026-11-12 |

---

## 3. What went well

- **We delivered what we committed.** Every Should Have is built, and every merged pull request was approved by the other partner.
- **Reviews found real bugs.** Three problems came from reading each other's pull requests, not from a failing test: a settle-up suggesting a payment already made (#112), a settle-up that could get stuck on an unconfirmed payment (#108), and the group lock deadlock (#124).
- **Test-first held up under the deadline, and concurrency bugs were reproduced before they were fixed.** Each feature pull request committed its failing tests before the code. The deadlock in #22 was reproduced by hand with two `psql` sessions before the lock changed, and #132's test reproduces the #124 deadlock for real, failing with `40P01` on the old code. The flaky cleanup in #79 failed in 3 of 40 runs on `main` and in 0 of 50 on the branch, so the fix was measured, not guessed.
- **Manual testing found what the tests missed.** Walking through #16's test checklist by hand before marking it ready found five bugs, among them a squeezed table and a YAML comment that cut off a description. Each one got a failing test before the fix.
- **AGENTS.md kept pace with what we learned.** When a review found a mistake an agent could repeat, it became a rule with a changelog line saying why: former members and locked expenses, pending payments and declining, the database clock, and public routes.
- **We followed the Sprint 2 retrospective.** Roles rotated, scope was capped at Should Haves with #54 and #77 left out, the hosted migration checklist was in every pull request with a migration, and #102 tracked the submission from the first day. The planning notes (#104) were written on 2026-11-08, the day the sprint started, with owners, points and a slip order, and Ziye opened eleven pull requests on 2026-11-08 and 2026-11-09, so most of the review time fell in the first half of the sprint instead of the last day.
- **The end-to-end suite is in CI.** All eight user flows have a Playwright spec, the tests run against a production build on every pull request, and e2e is now a required check. The production build also removed the flakes we had seen on #22, which came from the dev server compiling routes on demand.
- **Working async across time zones worked.** We split the shared issues (#16, #17, #102, #114) in one exchange, and most reviews came back within hours. Where an issue needed both of us to agree, such as deleting a declined direct payment in #108 or the former-member cost lock in #22, the author made a choice, explained the trade-off in the pull request and asked the other to confirm in review, so neither of us had to wait for the other to be online.

---

## 4. What did not go well

- **The plan didn't leave room for follow-up work.** We planned sixteen issues on 2026-11-08, and the same day six more had to be added (#79, #108, #112, #113, #114, #115). Reviews then turned up three more: #121, #124 and #130. Most of them were real bugs that had to be fixed, but they all competed with the planned features for the same six days, and #121 and #130 were closed without an estimate, so the points in Section 1 undercount the work.
- **The accessibility rule was missed in review.** AGENTS.md has said since 2026-11-06 that a new page or form goes into `e2e/accessibility.spec.ts` in the same pull request, but the check-off form (#98) and a past period of the bill (#125) were approved and merged without it. The gap was found at the end of the sprint and fixed in #135.

<!-- TODO(#103): add Barbara's points from her separate message. -->

---

## 5. What to change next time

1. **Leave room in the plan for follow-ups.** Commit fewer points than we think we can do, since Sprint 2 and Sprint 3 both added issues after planning, and put an estimate on each new issue when it is opened, including the ones found in review.
2. **Add "new page or form → accessibility spec" to the review checklist.** The rule exists; the reviewer should tick it like the migration checklist.

<!-- TODO(#103): add Barbara's points from her separate message. -->

---

## 6. Open items

- [#102](https://github.com/blouyakis/cs6983-project-2/issues/102): put the two halves of the demo video together, link it from the README, write each partner's 300-word reflection, and check the contribution log, standups and review counts. Due 2026-11-15.
- Open an issue for the register and login forms sending their fields as a query string when submitted before the page has loaded, which turned up while recording the demo.
- [#54](https://github.com/blouyakis/cs6983-project-2/issues/54) and [#77](https://github.com/blouyakis/cs6983-project-2/issues/77) stay in the backlog.
