# Sprint 3 planning

**Milestone:** [Sprint 3 v.03](https://github.com/blouyakis/cs6983-project-2/milestone/3), 2026-11-08 to 2026-11-13
**Sprint goal:** finish the Should Haves and ship the final submission: direct payments, the itemized bill, leaving a group, expense history with filters and the default split screen, with the API docs, the end-to-end suite in CI and the demo video.
**Product Owner:** Barbara · **Scrum Master:** Ziye

## 1. The issues

The milestone held seventeen open issues at planning, and seven more were added after it. Points use the Fibonacci scale (1, 2, 3, 5, 8, 13) and measure size relative to each other, not hours: a 1 is a few lines with a test, a 5 is a feature across the database, the API and a screen, and an 8 adds a SQL function or a new list across groups. Each issue's points are also in a comment on the issue, since the board has no estimate field. Owners were agreed on Slack on 2026-11-08; "not decided yet" means we haven't picked one.

| Issue | Owner | Priority | Points | Status on 2026-11-08 |
|---|---|---|---|---|
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense (from Sprint 2) | Barbara | medium | 8 | Done: PR #98 |
| [#89](https://github.com/blouyakis/cs6983-project-2/issues/89) Keep the sidebar's group balances current on client navigation (from Sprint 2) | Ziye | medium | 5 | Done: PR #109 |
| [#90](https://github.com/blouyakis/cs6983-project-2/issues/90) Load only this month's personal expenses and the open items for the overview (from Sprint 2) | Ziye | medium | 2 | Done: PR #105 |
| [#14](https://github.com/blouyakis/cs6983-project-2/issues/14) Pay one person directly and confirm it | Ziye | high | 5 | In Review: PR #107, approved; merges once `record_payment` is on the hosted database |
| [#15](https://github.com/blouyakis/cs6983-project-2/issues/15) Expense history with filters by group, person, and date range | Barbara | medium | 8 | Sprint ToDo |
| [#21](https://github.com/blouyakis/cs6983-project-2/issues/21) Itemized bill for each member | Barbara | medium | 5 | Sprint ToDo |
| [#22](https://github.com/blouyakis/cs6983-project-2/issues/22) Leave a group with read-only access to past history | Ziye | medium | 5 | Sprint ToDo |
| [#63](https://github.com/blouyakis/cs6983-project-2/issues/63) Set a group's default split ratio on the group page | Ziye | medium | 8 | Sprint ToDo |
| [#75](https://github.com/blouyakis/cs6983-project-2/issues/75) Take membership times from the database clock, not the server's | Ziye | low | 1 | Done: PR #106 |
| [#16](https://github.com/blouyakis/cs6983-project-2/issues/16) Public API documentation with OpenAPI/Swagger | Both; how to split it not decided yet | high | 3 | Sprint ToDo |
| [#17](https://github.com/blouyakis/cs6983-project-2/issues/17) End-to-end test suite covering the main user flows | Both, each the flows they build; the CI job not decided yet | high | 5 | Sprint ToDo |
| [#100](https://github.com/blouyakis/cs6983-project-2/issues/100) Health-check endpoint that shows the app and the database are up | Ziye | medium | 1 | Done: PR #111 |
| [#101](https://github.com/blouyakis/cs6983-project-2/issues/101) Run lint and format on staged files before each commit (Husky and lint-staged) | Ziye | low | 1 | Done: PR #110 |
| [#99](https://github.com/blouyakis/cs6983-project-2/issues/99) Write the Sprint 3 planning notes | Ziye | high | 2 | this pull request |
| [#102](https://github.com/blouyakis/cs6983-project-2/issues/102) Project 2 submission: demo video, reflections and contribution log | Both, each their own reflection; the rest not decided yet | high | 5 | Sprint ToDo |
| [#103](https://github.com/blouyakis/cs6983-project-2/issues/103) Write the Sprint 3 retrospective and bring the final docs up to date | Ziye | high | 3 | Sprint ToDo |
| [#54](https://github.com/blouyakis/cs6983-project-2/issues/54) Export the filtered expense list as CSV (Could Have) | — | low | 3 | Not done this sprint (section 2) |

Added to the milestone after planning:

| Issue | Owner | Priority | Points | Status on 2026-11-08 | Where it came from |
|---|---|---|---|---|---|
| [#108](https://github.com/blouyakis/cs6983-project-2/issues/108) Let the recipient decline a payment marked paid, so a settle-up can't get stuck | Ziye | medium | 5 | Sprint ToDo | Review of #107 |
| [#112](https://github.com/blouyakis/cs6983-project-2/issues/112) Don't let a settle-up suggest a payment that a pending direct payment already covers | Barbara | medium | 3 | Sprint ToDo | Review of #107 |
| [#113](https://github.com/blouyakis/cs6983-project-2/issues/113) update-expense test fails at random: sharesOf returns equal shares in any order | Whoever is free first | low | 1 | Sprint ToDo | Full test runs for #106 |
| [#79](https://github.com/blouyakis/cs6983-project-2/issues/79) Database tests fail at random in cleanup with groups_created_by_fkey | Whoever is free first | low | 2 | Sprint ToDo | The Backlog (section 2) |
| [#114](https://github.com/blouyakis/cs6983-project-2/issues/114) Decide whether previews get their own Supabase project | not decided yet | low | 1 | Sprint ToDo | Testing #111 |
| [#115](https://github.com/blouyakis/cs6983-project-2/issues/115) Say in AGENTS.md that public routes skip the session check | not decided yet | low | 1 | Sprint ToDo | Review of #111 |
| [#77](https://github.com/blouyakis/cs6983-project-2/issues/77) Use the user's time zone for timestamps, today and this month | — | low | 5 | Backlog | Not done this sprint (section 2) |

## 2. Moves made during planning

- **#12, #89 and #90 carry over from Sprint 2.** #12 slipped as the Sprint 2 planning notes expected (section 3 there) and is in draft PR #98. #89 and #90 came out of the review of #10 on 2026-11-06, one day before Sprint 2 ended; the Sprint 2 retrospective already lists them for Sprint 3.
- **#54 and #77 are not done this sprint** (agreed 2026-11-08). The Sprint 2 retrospective caps Sprint 3 at Should Haves, and #54 is a Could Have that needs #15 first, so it doesn't count toward the committed points. #77 changes how every timestamp and "this month" is worked out, which is too wide a change this close to the deadline; its `TODO(#77)` markers stay. Both go back to the Backlog.
- **#18's remainder is #103.** #18 was closed when the Sprint 2 retrospective merged with `Closes #18`; #95 delivered its accessibility checks and docs, and #103 holds the Sprint 3 retrospective and the final pass over the docs.
- **#79 joins the sprint as a pick-up item.** It is a low-priority flaky database test cleanup that blocks no Sprint 3 issue, so whoever is free first takes it, like #113.

## 3. Load and risks

**Load.** Twenty-two issues and 80 points for two people: 67 points in the sixteen committed at planning, and 13 in the six added after it. #54 and #77 aren't counted. That load comes before a deadline that can't move (2026-11-13). The Sprint 2 retrospective found its scope too large, so the slip order below matters.

**Order of work.**

1. **#12, #89, #90, #75, #100 and #101 first.** All six were done by 2026-11-08. #22 needed #75: a former member's `left_at` must come from the database clock.
2. **Then the features: #14, #21, #22, #15 and #63, with #112 and #108 beside them.** #17's flows 6, 7 and 8 need #14, #21 and #22. #22, #108 and #112 need #14, because each of them handles a direct payment that is marked paid but not yet confirmed.
3. **#16 and #17 as the routes land, and #113, #79, #114 and #115 whenever one of us is free.** #17's CI job is a change to `ci.yml`, which a partner makes (AGENTS.md Section 7).
4. **#102 and #103 last**, after the feature pull requests merge. The demo video should be recorded no later than 2026-11-12, so a re-take still fits.

**What slips first if the sprint runs late:** #79, then #108, then #63. #54 and #77 are already out (section 2). #79 is a flaky test cleanup that blocks nothing. #108 isn't in the PRD and changes a rule in AGENTS.md Section 6.10. #63 is the largest Should Have left, and expenses can already be split by custom amounts without it.

**Other risks.**

- **Review.** Twenty-two issues in six days means three or four pull requests a day. The Sprint 2 retrospective sets a limit of one or two open pull requests per person, so each of us opens the next one only when a review has come back.
- **The end-to-end suite isn't in CI yet (#17).** The run of #98 on 2026-11-07 found a failing test that CI couldn't see. Until #17 adds the job, run `npm run test:e2e` before asking for a review of a pull request that changes a page.
- **Previews have no database yet.** In Vercel, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set for Production only, so on a preview `GET /api/health` answers `503` and nothing that reads the database works (found in #111). We agree previews must not point at the production database: their test accounts would mix with real ones, and a user can't be deleted (#84). Until #114 decides whether they get their own Supabase project, test every page locally.
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

- Pick owners for the issues and parts marked "not decided yet" (section 1), then add each issue's points to the issue itself (#99).
- Sprint 1 has a retrospective but no planning notes, although `p2-from-zero-checklist.md` checks them off, and the checklist also checks off estimates that Sprints 1 and 2 didn't have. Correct the checklist in #102.