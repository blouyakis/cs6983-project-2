# Sprint 2 planning

**Milestone:** [Sprint 2 v.02](https://github.com/blouyakis/cs6983-project-2/milestone/2), 2026-11-01 to 2026-11-07
**Sprint goal:** groups that share costs end to end: create a group, log and split costs, see who owes whom, and settle up.
**Product Owner:** Ziye · **Scrum Master:** Barbara

> Written on 2026-11-04 by Barbara, three days into the sprint, from what the board, the milestone and the pull requests show (#67). The Sprint 1 retrospective asked for these notes and they were late; #18 would otherwise have written them after the sprint, which is how the Sprint 1 docs went stale. Statuses are as of the evening of 2026-11-04 and can be checked on the [board](https://github.com/users/blouyakis/projects/3). The Sprint 2 retrospective is #18, written at the end of the sprint.

## 1. The issues

The milestone holds nineteen issues: the ten planned on 2026-10-25 and nine added during the sprint. #13 and #14 were taken out at planning (section 2). Owners come from the assignee or, for closed issues, from who wrote the pull request.

| Issue | Owner | Priority | Status on 2026-11-04 |
|---|---|---|---|
| [#6](https://github.com/blouyakis/cs6983-project-2/issues/6) Create groups and invite members | Ziye | high | Done (#61) |
| [#7](https://github.com/blouyakis/cs6983-project-2/issues/7) Log personal and group expenses | Barbara | high | Done (#65) |
| [#8](https://github.com/blouyakis/cs6983-project-2/issues/8) Split group expenses evenly, by custom amounts, or by default ratio | Ziye | high | Done (#55) |
| [#9](https://github.com/blouyakis/cs6983-project-2/issues/9) Compute balances: who owes whom per group | Barbara | high | In Progress: server side in a draft PR, the group-page UI waits on #53 |
| [#10](https://github.com/blouyakis/cs6983-project-2/issues/10) Dashboard: personal totals, group shares, and net balance | not decided | high | Sprint ToDo |
| [#11](https://github.com/blouyakis/cs6983-project-2/issues/11) To-do items with estimated cost and running total | not decided | medium | Sprint ToDo |
| [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) Shared shopping list: checking off an item creates an expense | not decided | medium | Sprint ToDo |
| [#19](https://github.com/blouyakis/cs6983-project-2/issues/19) Group settle-up with the fewest payments | not decided | high | Sprint ToDo |
| [#20](https://github.com/blouyakis/cs6983-project-2/issues/20) Edit and delete unsettled expenses | Barbara | high | In Review |
| [#23](https://github.com/blouyakis/cs6983-project-2/issues/23) Personal space with its own list and personal expenses | not decided | medium | Sprint ToDo |
| [#51](https://github.com/blouyakis/cs6983-project-2/issues/51) Let the member who checked off an item uncheck it (added 2026-10-31) | Ziye | medium | Done (#52) |
| [#53](https://github.com/blouyakis/cs6983-project-2/issues/53) App shell and shared UI components (added 2026-10-31) | Barbara | high | In Review (#70) |
| [#56](https://github.com/blouyakis/cs6983-project-2/issues/56) FormSheet: the shared form container (added 2026-11-01) | Ziye | high | Done (#57) |
| [#58](https://github.com/blouyakis/cs6983-project-2/issues/58) Safari can't log in on the local dev server (added 2026-11-01) | Ziye | medium | Done (#60) |
| [#62](https://github.com/blouyakis/cs6983-project-2/issues/62) Rethrow Next.js internal errors in toErrorResponse (added 2026-11-03) | Ziye | low | Done (#64) |
| [#66](https://github.com/blouyakis/cs6983-project-2/issues/66) Create the personal space when a user registers (added 2026-11-04) | Barbara | high | In Review |
| [#67](https://github.com/blouyakis/cs6983-project-2/issues/67) Write the Sprint 2 planning notes (added 2026-11-04) | Barbara | medium | this pull request |
| [#68](https://github.com/blouyakis/cs6983-project-2/issues/68) Lists and Settle up pages for the app navigation (added 2026-11-04) | Barbara | medium | Sprint ToDo |
| [#69](https://github.com/blouyakis/cs6983-project-2/issues/69) Apply migrations to the hosted Supabase project and document how (added 2026-11-04) | Barbara | high | Sprint ToDo |

Seven are done, four are in review, one is in progress, and seven are still to do.

## 2. Moves made during planning

- **#14 (direct payments between two members) moved to Sprint 3.** The PRD lists it as a Should Have, and settle-up (#19) works without it: balances count confirmed payments whatever created them, so a direct payment is a second way to make one, not a prerequisite.
- **#13 is covered by #12.** Both described checking off a list item and creating its expense; #12 kept the acceptance criteria and #13 should be closed as a duplicate.
- **#66 split out of #23**, as the Sprint 1 retrospective asked (item 7): registration going through `register_user` is a one-evening chore that both #23 and #10 depend on, so it is tracked on its own.
- **#67, #68 and #69 were added on 2026-11-04** when the board was reviewed: these notes; the two navigation pages that #53 links to but no issue built; and the hosted database, which `main` deploys against without any step that applies migrations to it.

## 3. Load and risks

Seven issues are left to do with three days of the sprint remaining, and five of them have no owner yet. That is more than one person-week, so one or more will slip to Sprint 3.

**Order of work.** The dependencies decide it:

1. **#53, #9 and #23 first.** #53 gives every other page its layout and `MoneyText`; #9 gives every screen its balances; #23 is the first screen the overview needs. #66 is a prerequisite of #23 and #10 and is already in review.
2. **Then #10 and #19.** The overview (#10) shows the balances from #9 and the personal space from #23. Settle-up (#19) starts from the balances in #9.
3. **#20 builds `ConfirmDialog` for #12.** #12 reuses it when an item is unchecked (#51's rule), so #20 merging first saves #12 building its own.
4. **#68 needs the most**: #53 for the layout, #9 for balances, #11 for open item counts, #19 for the settle-up screen and #23 for the personal space. It can start with what exists and finish last.

**What slips first if the sprint runs late: #12.** It has the most behavior (the check-off form, the expense it creates, the uncheck rule from #51) and nothing else in Sprint 2 depends on it. #68 is next, since its two pages are navigation targets rather than features.

**Other risks.**

- **Review is the bottleneck.** Four of Barbara's pull requests are waiting on Ziye at once (#70, #9, #20, #66). Two of them (#70 and #20) touch the same paragraph of DESIGN.md and whichever merges second needs `main` merged in first.
- **Hosted database drift (#69).** `main` deploys to production on every merge, but nothing applies new migrations to the hosted project. Any route that needs `group_functions`, `update_group`, `update_expense` or `ensure_personal_spaces` fails there with a 500 until they are applied.
- **One sprint, one week, two people.** The Sprint 1 retrospective flagged ten issues as a lot; the count has since grown with the chores above.

## 4. Sprint 1 "What to change", applied

| Item | How Sprint 2 follows it |
|---|---|
| 1. Tick the acceptance criteria in the closing pull request | Partly. The pull request bodies say how each criterion was tested, and the issue checkboxes are ticked at close. Listing the criteria themselves in the PR body is still inconsistent |
| 2. Update the README and AGENTS.md tree in the feature PR | #61 brought README, architecture.md, AGENTS.md and the API spec up to date with groups in the same PR; #65 updated the API spec and DESIGN.md. These notes update the tree for `docs/sprints/sprint-2/` |
| 3. Keep required checks in step with CI | No CI job was added in Sprint 2; the seven required checks still match `ci.yml` |
| 4. One issue, one branch, one pull request | Every Sprint 2 issue so far has one branch and one PR, from `main`. #53 and #9 were kept separate even though #9's UI needs #53, at the cost of #9 waiting |
| 5. PR titles follow the commit convention | Every Sprint 2 pull request carries its issue number. Not all use the type prefix (#64 is "Rethrow Next.js internal errors in toErrorResponse (#62)"), so the habit is half formed |
| 6. Plan the sprint on the board | Done on 2026-11-04: every Sprint 2 issue is in Sprint ToDo or further right, and the Backlog holds only Sprint 3 issues |
| 7. Wire registration to `register_user` in its own issue | #66, in review |

## 5. Open items

- Assign #10, #11, #12, #19 and #23, and decide now which of them move to Sprint 3 rather than finding out on 2026-11-07.
- Close #13 as a duplicate of #12.
- Apply the pending migrations to the hosted project (#69) before any more routes that depend on them reach production.
