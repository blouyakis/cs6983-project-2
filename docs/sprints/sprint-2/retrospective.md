# Sprint 2 retrospective

**Milestone:** [Sprint 2 v.02](https://github.com/blouyakis/cs6983-project-2/milestone/2), 2026-11-01 to 2026-11-07  
**Sprint goal:** groups that share costs end to end: create a group, log and split costs, see who owes whom, and settle up.  
**Product Owner:** Ziye · **Scrum Master:** Barbara  

> Draft prepared from the repository, pull request and commit history by Barbara (Scrum Master) on 2026-11-06 (#18), on the penultimate evening of the sprint. All issue numbers, PR links, and commit metrics reflect `main` at `3829eac`. The "What to change in Sprint 3" items are recommendations for the team to adopt during Sprint 3 planning, when roles rotate.

---

## 1. Planned and delivered

Nineteen issues were tracked for Sprint 2 (ten planned on 2026-10-25 and nine added during the sprint, as recorded in `docs/sprints/sprint-2/planning.md`). Five additional issues (#76, #83, #84, #86, and follow-ups #89/#90) arose from code reviews and concurrency audits during execution. 

Seventeen feature and bug issues were closed across 23 merged pull requests. The sprint goal was fully achieved: users can create groups, log and split expenses, inspect per-group balances and the overview dashboard, and settle up with minimal transactions.

| Issue | Owner | Pull requests | Result |
|---|---|---|---|
| [#6](https://github.com/blouyakis/cs6983-project-2/issues/6) Create groups and invite members | Ziye | #61 | Done |
| [#7](https://github.com/blouyakis/cs6983-project-2/issues/7) Log personal and group expenses | Barbara | #65 | Done |
| [#8](https://github.com/blouyakis/cs6983-project-2/issues/8) Split group expenses evenly, by custom amounts, or by default ratio | Ziye | #55 | Done |
| [#9](https://github.com/blouyakis/cs6983-project-2/issues/9) Compute balances: who owes whom per group | Barbara | #71 | Done |
| [#10](https://github.com/blouyakis/cs6983-project-2/issues/10) Dashboard: personal totals, group shares, and net balance | Ziye | #91 | Done |
| [#11](https://github.com/blouyakis/cs6983-project-2/issues/11) To-do items with estimated cost and running total | Ziye | #78 | Done |
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense | not decided | — | Moved to Sprint 3 |
| [#19](https://github.com/blouyakis/cs6983-project-2/issues/19) Group settle-up with the fewest payments | Ziye | #82 | Done |
| [#20](https://github.com/blouyakis/cs6983-project-2/issues/20) Edit and delete unsettled expenses | Barbara | #72 | Done |
| [#23](https://github.com/blouyakis/cs6983-project-2/issues/23) Personal space with its own list and personal expenses | Ziye | #81 | Done |
| [#51](https://github.com/blouyakis/cs6983-project-2/issues/51) Let the member who checked off an item uncheck it (added 2026-10-31) | Ziye | #52 | Done |
| [#53](https://github.com/blouyakis/cs6983-project-2/issues/53) App shell and shared UI components (added 2026-10-31) | Barbara | #70 | Done |
| [#56](https://github.com/blouyakis/cs6983-project-2/issues/56) FormSheet: the shared form container (added 2026-11-01) | Ziye | #57 | Done |
| [#58](https://github.com/blouyakis/cs6983-project-2/issues/58) Safari can't log in on the local dev server (added 2026-11-01) | Ziye | #60 | Done |
| [#62](https://github.com/blouyakis/cs6983-project-2/issues/62) Rethrow Next.js internal errors in toErrorResponse (added 2026-11-03) | Ziye | #64 | Done |
| [#66](https://github.com/blouyakis/cs6983-project-2/issues/66) Create the personal space when a user registers (added 2026-11-04) | Barbara | #73 | Done |
| [#67](https://github.com/blouyakis/cs6983-project-2/issues/67) Write the Sprint 2 planning notes (added 2026-11-04) | Barbara | #74 | Done |
| [#68](https://github.com/blouyakis/cs6983-project-2/issues/68) Lists and Settle up pages for the app navigation (added 2026-11-04) | Barbara | — | In progress |
| [#69](https://github.com/blouyakis/cs6983-project-2/issues/69) Apply migrations to the hosted Supabase project and document how (added 2026-11-04) | Barbara | — | Sprint ToDo |
| [#76](https://github.com/blouyakis/cs6983-project-2/issues/76) Move focus to Cancel when ConfirmDialog is busy and ignore late close (added 2026-11-05) | Barbara | #80 | Done |
| [#83](https://github.com/blouyakis/cs6983-project-2/issues/83) Let ensure_personal_spaces skip a user deleted mid-run (added 2026-11-05) | Barbara | #85 | Done |
| [#84](https://github.com/blouyakis/cs6983-project-2/issues/84) Note in architecture §9 that the app can't delete a user (added 2026-11-06) | Ziye | #92 | Done |
| [#86](https://github.com/blouyakis/cs6983-project-2/issues/86) Lock expenses in an open settle-up and take balances from one cut-off (added 2026-11-05) | Barbara | #87 | Done |
| [#89](https://github.com/blouyakis/cs6983-project-2/issues/89) Sidebar balances staleness during link navigation (added 2026-11-06) | Ziye | — | Backlog / Sprint 3 |
| [#90](https://github.com/blouyakis/cs6983-project-2/issues/90) Query only this month's personal expenses and open list items (added 2026-11-06) | Ziye | — | Backlog / Sprint 3 |
| [#18](https://github.com/blouyakis/cs6983-project-2/issues/18) Sprint 2 retrospective (added 2026-11-06) | Barbara | this pull request | In review |

---

## 2. The sprint in numbers

On `main` after the merge of #92 (`3829eac`):

| Measure | Value |
|---|---|
| Merged pull requests in Sprint 2 | 23 |
| Non-merge commits in Sprint 2 | 365 (Ziye 212, Barbara 153) |
| Unit and integration tests (Vitest) | 1,128 tests across 115 test files (95% line coverage, 100% `lib/domain`) |
| Database tests (local Supabase Postgres) | 228 tests across 28 test files in `supabase/tests/` |
| Playwright E2E scenarios | 28 tests across 9 spec files |
| SQL migrations added in Sprint 2 | 9 (`group_functions`, `update_group`, `update_expense`, `ensure_personal_spaces`, `personal_space_owner_only`, `settle_up`, `personal_space_fixed`, `ensure_personal_spaces_skips_gone`, `settle_up_locks`) |
| CI required checks | 7: install, lint, typecheck, test, db-test, build, audit |
| Production deployment | <https://cs6983-project-2.vercel.app>, continuously deployed from `main` |

Every pull request had partner review and approval prior to merging.

---

## 3. What went well

- **The Sprint Goal was fully delivered.** The core lifecycle of shared everyday finances (creating a group, inviting members, logging expenses, splitting them evenly/custom/weighted, tracking balances, viewing the overview dashboard, and running an optimal settle-up) now works end-to-end in production.
- **TDD discipline was maintained at high velocity.** Across 365 non-merge commits, the team consistently committed failing tests first, followed by implementation commits. The test suite expanded from 148 unit tests at the end of Sprint 1 to 1,128 tests in Sprint 2, while maintaining 100% coverage of `lib/domain`.
- **Database concurrency and race conditions were proactively solved.** Rather than treating Postgres as a dumb store, complex financial state transitions were hardened with transactional functions and row locks:
  - In #83, `ensure_personal_spaces` was made resilient to users deleted mid-run during test teardowns.
  - In #86, `start_settlement` introduced cut-off timestamps from the database clock and atomic balances validation, and locked expenses in an open settle-up to prevent balance drift during settlements.
  - Multi-connection Vitest tests verified these locks against real Postgres concurrent sessions.
- **Reviews caught real bugs and improved design.** Code reviews served as genuine quality gates:
  - Ziye's review of #82 revealed that allowing expense edits during an active settle-up corrupted balance invariants at closure, directly prompting #86.
  - Barbara's review of #81 surfaced the fact that personal space ownership must never be mutable, prompting `groups_personal_space_fixed` and #84.
  - Review of #10 surfaced App Router layout caching (#89) and query efficiency (#90), which were cleanly documented as follow-ups rather than bloating the PR.
- **Accessibility (WCAG 2.1 AA) was baked into all new components.** Balances are never communicated via color alone (always qualified in words like "You owe", "You are owed", "You are all settled up"). Contrast issues on dark backgrounds (`data-on-ink`) were systematically handled, dialog focus was trapped with Escape key handlers (#76), and form controls retained semantic HTML structure.

---

## 4. What did not go well

- **Sprint scope was too large.** Nineteen planned and added issues was excessive for a one-week sprint with two people. Although the team achieved the core sprint goal, secondary items like #12 (checking off list items to create expenses) and #68 (dedicated `/lists` and `/settle-up` landing pages) were squeezed against the deadline and had to be pushed or finished at the very end.
- **Mid-sprint review bottleneck.** On 2026-11-04, four PRs by Barbara (#70, #9, #20, #66) were waiting on review simultaneously. Because #10 and #19 had direct dependencies on those PRs, work stalled momentarily until the review logjam was cleared.
- **Hosted database drift (#69).** While Vercel deployed each merge to `main` automatically, migrations were only run against local Docker Supabase. The hosted Supabase project accumulated unapplied migrations (`20261103` through `20261106`), which could cause production 500 errors on routes calling new database functions until manually applied.
- **Next.js App Router layout caching surprises (#89).** The team discovered that Server Components in `layout.tsx` (such as `SidebarGroups`) do not re-render upon soft client `<Link>` navigations. While local user mutations invoke `router.refresh()`, mutations made by other users in the background only appear upon hard reload.

---

## 5. What to change in Sprint 3

Sprint 3 ([milestone](https://github.com/blouyakis/cs6983-project-2/milestone/3), 2026-11-08 to 2026-11-13) is the final sprint before Project 2 completion.

1. **Rotate Scrum roles.** As agreed, Barbara takes over as Product Owner and Ziye takes over as Scrum Master for Sprint 3.
2. **Cap Sprint 3 scope strictly to Should-Have stories:**
   - Complete [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) (checking off items creates an expense, with #51 uncheck undo).
   - Complete [#68](https://github.com/blouyakis/cs6983-project-2/issues/68) (Lists and Settle-up navigation pages).
   - Implement [#14](https://github.com/blouyakis/cs6983-project-2/issues/14) (direct payments between two members before settle-up).
   - Implement [#15](https://github.com/blouyakis/cs6983-project-2/issues/15) (Itemized bill and expense filters).
   - Address follow-ups [#89](https://github.com/blouyakis/cs6983-project-2/issues/89) and [#90](https://github.com/blouyakis/cs6983-project-2/issues/90).
3. **Automate or establish a routine for hosted migrations (#69).** Apply all pending migrations to production Supabase at the start of Sprint 3 and document the exact migration procedure in `README.md` and `docs/deploy.md`.
4. **Enforce a strict Work-In-Progress (WIP) limit.** Maximum 1–2 open PRs per person to avoid the mid-sprint review bottleneck.
5. **Schedule project submission deliverables early.** Allocate time early in Sprint 3 for the 10-minute demo video, 300-word individual reflections, and final contribution log auditing.

---

## 6. Open items

- Finalize and merge [#68](https://github.com/blouyakis/cs6983-project-2/issues/68) (`/lists` and `/settle-up` landing pages).
- Apply all pending database migrations to the hosted Supabase project ([#69](https://github.com/blouyakis/cs6983-project-2/issues/69)).
- Open the Sprint 3 milestone and conduct Sprint 3 planning on 2026-11-07.
