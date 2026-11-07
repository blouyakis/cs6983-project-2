# Sprint 3 planning

**Milestone:** [Sprint 3 v.03](https://github.com/blouyakis/cs6983-project-2/milestone/3), 2026-11-08 to 2026-11-13
**Sprint goal (proposed):** finish the Should Haves and ship the final submission: direct payments, the itemized bill, leaving a group, expense history with filters and the default split screen, with the API docs, the end-to-end suite in CI and the demo video.
**Product Owner:** Barbara · **Scrum Master:** Ziye

> Drafted on 2026-11-07 by Ziye, as Scrum Master, from the milestone, the board and the pull requests (#99). It is a draft for the planning meeting with Barbara: the sprint goal, the story points and the owners marked "to decide" are proposals until both partners agree on them (P2: "Sprint planning done jointly"). Statuses are as of 2026-11-07. The Sprint 3 retrospective is #103.

## 1. The issues

The milestone holds seventeen open issues. Points use the Fibonacci scale (1, 2, 3, 5, 8, 13) and measure size relative to each other, not hours: a 1 is a few lines with a test, a 5 is a feature across the database, the API and a screen, and an 8 adds a SQL function or a new list across groups. Owners come from the assignee; the rest are decided at planning.

| Issue | Owner | Priority | Points | Status on 2026-11-07 |
|---|---|---|---|---|
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense (from Sprint 2) | Barbara | medium | 8 | In Progress: draft PR #98, e2e 42/43 locally |
| [#89](https://github.com/blouyakis/cs6983-project-2/issues/89) Keep the sidebar's group balances current on client navigation (from Sprint 2) | Ziye | medium | 5 | Sprint ToDo |
| [#90](https://github.com/blouyakis/cs6983-project-2/issues/90) Load only this month's personal expenses and the open items for the overview (from Sprint 2) | Ziye | medium | 2 | In Progress: tests and queries on a branch, service left |
| [#14](https://github.com/blouyakis/cs6983-project-2/issues/14) Pay one person directly and confirm it | to decide | high | 5 | Sprint ToDo |
| [#15](https://github.com/blouyakis/cs6983-project-2/issues/15) Expense history with filters by group, person, and date range | to decide | medium | 8 | Sprint ToDo |
| [#21](https://github.com/blouyakis/cs6983-project-2/issues/21) Itemized bill for each member | to decide | medium | 5 | Sprint ToDo |
| [#22](https://github.com/blouyakis/cs6983-project-2/issues/22) Leave a group with read-only access to past history | to decide | medium | 5 | Sprint ToDo |
| [#63](https://github.com/blouyakis/cs6983-project-2/issues/63) Set a group's default split ratio on the group page | to decide | medium | 8 | Sprint ToDo |
| [#75](https://github.com/blouyakis/cs6983-project-2/issues/75) Take membership times from the database clock, not the server's | Ziye | low | 1 | Sprint ToDo |
| [#16](https://github.com/blouyakis/cs6983-project-2/issues/16) Public API documentation with OpenAPI/Swagger | to decide | high | 3 | Sprint ToDo |
| [#17](https://github.com/blouyakis/cs6983-project-2/issues/17) End-to-end test suite covering the main user flows | to decide | high | 5 | Sprint ToDo |
| [#100](https://github.com/blouyakis/cs6983-project-2/issues/100) Health-check endpoint that shows the app and the database are up | to decide | medium | 1 | Sprint ToDo |
| [#101](https://github.com/blouyakis/cs6983-project-2/issues/101) Run lint and format on staged files before each commit (Husky and lint-staged) | to decide | low | 1 | Sprint ToDo |
| [#99](https://github.com/blouyakis/cs6983-project-2/issues/99) Write the Sprint 3 planning notes | Ziye | high | 2 | this pull request |
| [#102](https://github.com/blouyakis/cs6983-project-2/issues/102) Project 2 submission: demo video, reflections and contribution log | to decide | high | 5 | Sprint ToDo |
| [#103](https://github.com/blouyakis/cs6983-project-2/issues/103) Write the Sprint 3 retrospective and bring the final docs up to date | Ziye | high | 3 | Sprint ToDo |
| [#54](https://github.com/blouyakis/cs6983-project-2/issues/54) Export the filtered expense list as CSV (Could Have) | — | low | 3 | Out of scope unless time is left (section 2) |

**Committed: 67 points** in sixteen issues, without #54. Three are in progress (#12, #90 and this one) and thirteen are still to do. #13 (a duplicate of #12), #18 (its remainder is #103) and #83 are already closed in this milestone.

## 2. Moves made during planning

- **#12, #89 and #90 carry over from Sprint 2.** #12 slipped as the Sprint 2 planning notes expected (section 3 there) and is in draft PR #98. #89 and #90 came out of the review of #10 on 2026-11-06, one day before Sprint 2 ended; the Sprint 2 retrospective already lists them for Sprint 3.
- **#54 is out of scope** unless every Should Have is done. The Sprint 2 retrospective caps Sprint 3 at Should Haves, and #54 is a Could Have that needs #15 first. It stays in the milestone so it can be pulled in, but it doesn't count toward the committed points.
- **#18's remainder is #103.** #18 was closed when the Sprint 2 retrospective merged with `Closes #18`; #95 delivered its accessibility checks and docs, and #103 holds the Sprint 3 retrospective and the final pass over the docs.
- **#77 and #79 stay in the Backlog.** Both are low-priority bugs with no milestone: the time zone for "this month" (#77) and a flaky database test cleanup (#79). Neither blocks a Sprint 3 issue.

## 3. Load and risks

**Velocity.** Sprint 2 had no estimates. Sized afterwards by Ziye on the same scale, the Sprint 2 issues that closed come to about 80 points in seven days, so 67 points in six days is close to what the team has done. The Sprint 2 retrospective says that pace was too much ("Sprint scope was too large"), and the deadline on 2026-11-13 can't move, so the slip order below matters.

**Order of work.**

1. **#12, #90 and #75 first.** #12 and #90 are nearly done. #75 is one point and #22 needs it: a former member's `left_at` must come from the database clock.
2. **Then the features: #14, #21, #22, #15 and #63.** #17's flows 6, 7 and 8 need #14, #21 and #22. #54 needs #15.
3. **#16, #17 and #100 as the routes land.** #17's CI job is a change to `ci.yml`, which a partner makes (AGENTS.md Section 7).
4. **#102 and #103 last**, after the feature pull requests merge. The demo video should be recorded no later than 2026-11-12, so a re-take still fits.

**What slips first if the sprint runs late:** #54 (not committed), then #101, then #63. #101 is a developer convenience. #63 is the largest Should Have left, and expenses can already be split by custom amounts without it.

**Other risks.**

- **Review.** Sixteen issues in six days means about three pull requests a day. The Sprint 2 retrospective sets a limit of one or two open pull requests per person, so each of us opens the next one only when a review has come back.
- **The end-to-end suite isn't in CI yet (#17).** The run of #98 on 2026-11-07 found a failing test that CI couldn't see. Until #17 adds the job, run `npm run test:e2e` before asking for a review of a pull request that changes a page.
- **Previews share the production database.** `docs/architecture.md` Section 7 says previews use the hosted project, so a test account made on a preview stays in production, and a user can't be deleted (#84). Test pages locally, and use previews only for a final check with a clearly named test account.
- **Migrations reach production before merge** (#69, `docs/architecture.md` Section 7). A migration applied while its pull request is still in review has to work with the code already on `main`, and can't be edited afterwards.

## 4. Sprint 2 "What to change", applied

| Item | How Sprint 3 follows it |
|---|---|
| 1. Rotate Scrum roles | Done: Barbara is Product Owner and Ziye is Scrum Master |
| 2. Cap scope at Should Haves | #54, the one Could Have, is out of the committed points (section 2) |
| 3. A routine for hosted migrations | Done in #96: `docs/architecture.md` Section 7 and the README say how and when, and the pull request template has a migration checklist |
| 4. A WIP limit of one or two open pull requests per person | Adopted for this sprint (section 3, Review) |
| 5. Schedule the submission early | #102 tracks the demo video, the reflections and the contribution log, with the video no later than 2026-11-12 |

## 5. Open items

- Agree on the sprint goal, the points and the owners marked "to decide" at the planning meeting, then add each issue's points to the issue itself (#99).
- Sprint 1 has a retrospective but no planning notes, although `p2-from-zero-checklist.md` checks them off, and the checklist also checks off estimates that Sprints 1 and 2 didn't have. Correct the checklist in #102.
- Fix the failing `e2e/lists.spec.ts` test in #98 before it leaves draft.
