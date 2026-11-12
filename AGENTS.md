# AGENTS.md

## 0. How to use this file

You are working on **LifeBoard**, a web app for planning and paying for everyday life, alone or with others. This file overrides your habits. If it disagrees with the PRD, stop and ask. Change it in a PR, and add a Changelog line.

---

## 1. Tech stack and versions

_Why: CI and Vercel build with exactly these versions. Next.js 16 changed APIs that older examples still use, so code written from memory often breaks._

- Node.js 26, Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, Supabase Postgres (database only, through `@supabase/supabase-js`; the Supabase CLI is pinned in `devDependencies`), `jose`, `bcryptjs`, Zod 4, Vitest, Playwright, Prettier, OpenAPI 3, npm, Vercel, GitHub Actions

Before writing Next.js code, read the matching page in `node_modules/next/dist/docs/01-app`. Those pages match the installed Next.js 16. This file still wins if they disagree. Do not follow `02-pages`; the Pages Router is forbidden.

### Commands

```bash
npm run dev            # start the dev server
npm run lint           # ESLint, Prettier check, then Redocly on docs/api/openapi.yaml
npm run format         # Prettier write
npm run typecheck      # tsc --noEmit
npm test               # Vitest unit tests (no Docker needed)
npm run test:db        # Vitest database tests in supabase/tests (run npx supabase start first)
npm run test:coverage  # unit tests with the coverage thresholds in Section 4
npm run test:e2e       # Playwright
npm run build          # production build
npx supabase start     # local Supabase (requires Docker)
npx supabase db reset  # re-apply all migrations to the local database
```

### Environment variables

Names only, in `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` stay on the server.

---

## 2. Architecture overview

_Why: Every request takes the same path, so access checks and validation live in one place and no screen can skip them._

### Folder structure

This is the structure on `main` at the end of Sprint 3.

```text
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── DESIGN.md
├── .env.example
├── .github/workflows/ci.yml
├── docs/
│   ├── PRD.md
│   ├── user-stories.md
│   ├── architecture.md
│   ├── research/ design/ hw3/
│   ├── api/openapi.yaml
│   └── sprints/             # sprint-1/ retrospective, sprint-2/ planning and retrospective, sprint-3/ planning and retrospective, issue-4-comparison.md
├── supabase/
│   ├── migrations/
│   ├── seed.sql             # demo data for local development
│   └── tests/               # database tests (npm run test:db)
├── e2e/
└── src/
    ├── proxy.ts
    ├── app/                 # (auth), (app), api
    ├── components/          # ui/ and feature folders
    └── lib/                 # auth, db, domain, http, services, validation
```

### Key patterns

- Server Components by default. `"use client"` only for state, effects, or event handlers.
- Code flows route handler → service → domain and db. Zod at the boundary. Only `lib/db` talks to Supabase.
- Routes, the error shape, and status codes are in [docs/api/openapi.yaml](docs/api/openapi.yaml). The architecture and schema are in [docs/architecture.md](docs/architecture.md).

---

## 3. Naming conventions and coding standards

_Why: Both partners and every agent write code the same way, so reviews can focus on behavior instead of style._

- Components: PascalCase, one per file. Other TypeScript files: kebab-case. Tests sit next to the code.
- API routes: plural kebab-case. JSON keys: camelCase. Database: plural snake_case. Money fields end in `Cents`; timestamps end in `At`.
- `lib/db` maps `snake_case` columns to `camelCase` before anything leaves that layer; no other code sees column names.
- TypeScript `strict`, no `any`. Named exports, except `page.tsx` and `layout.tsx`. Services throw typed errors from `lib/http/errors.ts`.

---

## 4. Testing strategy

_Why: Project 2 grades test-driven development from the git history, and money bugs are easy to miss without tests._

- Vitest for unit and integration tests, Playwright for the flows in Section 5. Coverage: 80% lines, 100% of `lib/domain`.
- Rules the database enforces (constraints, triggers, SQL functions) are tested against local Supabase in `supabase/tests/`, next to the migrations.
- Commit the failing test first, then the code, then the refactor. Never in the same commit.
- `e2e/accessibility.spec.ts` runs `@axe-core/playwright` (WCAG 2.1 A and AA) on every main page and dialog at desktop and 375px wide, and tabs through the forms. A new page or form goes into it in the same PR.
- Before committing a `test(...)` commit, run `git diff --cached --stat` and confirm every file is a `*.test.*` or `e2e/*` file.

---

## 5. PRD and design references

_Why: The PRD and mockups decide what to build. These flows turn them into steps an agent can follow and Playwright can test._

- PRD: [docs/PRD.md](docs/PRD.md). User stories: [docs/user-stories.md](docs/user-stories.md).
- UI work follows [DESIGN.md](DESIGN.md). Mockups are in [docs/design/](docs/design/).

### User flows

These are also the Playwright scenarios.

1. **Sign up and first group:** register → land on the overview with an empty personal space → create a group → invite a member by email.
2. **Plan and buy:** add items to a group list → check one off → enter the actual cost and pick who shares it (default: everyone) → an expense is created with the current user as payer → every sharer’s balance updates → the item shows who completed it, the cost and when → the member who checked it off can uncheck it while its expense is unsettled, which deletes the expense and reopens the item.
3. **Add a cost directly:** add an expense that was never on the list → choose even or custom split → balances update.
4. **Fix a mistake:** the payer edits or deletes an unsettled expense → balances update → the expense shows it was edited.
5. **Settle up:** a member starts a settle-up → the app suggests the fewest payments → each payer marks their payment paid → each recipient confirms → when all are confirmed, the period closes, balances reset to zero, and those expenses are locked.
6. **Pay one person directly:** a member records a payment to another member before any settle-up → the recipient confirms → both balances and the suggested payments update.
7. **Check my bill:** open my bill for a group → see only the expenses I share, who paid, my share and what I owe each member → look at a past period.
8. **Move out:** a member with a zero balance leaves → they keep read-only access to history up to the day they left → the remaining members keep using the group. When the last member leaves, the group is archived.

---

## 6. Domain rules (must always hold)

_Why: Money bugs hide here: lost cents, rounding drift, and the wrong person editing or seeing data. These rules hold in every feature, not just the one that added them._

1. **Money is integer cents.** Never use floating point for money. Convert to dollars only when displaying.
2. **Even splits:** divide in cents; any leftover cents go to the **payer’s** share. Shares must always add up exactly to the expense total. The payer is always one of the sharers, so the leftover always has a place to go. To record a cost paid only for others, the payer uses custom amounts with 0 for themselves: $10.01 for Sam and Jo is payer 0, Sam 501, Jo 500.
3. **Custom splits** must add up to the total, or the request is rejected. A group’s default split ratio applies to new expenses and can be overridden per expense. The ratio reaches an expense through `SplitEditor`, which opens on Custom amounts filled in from the group’s weights; the server’s even mode is always 1:1. A member’s default share weight is a whole number from 1 to 100 (`MAX_SHARE_WEIGHT`), checked by Zod and by the database, so `amount × total weight` stays a safe integer when the largest amount is split among 12 members.
4. **Balances:** a member’s balance is (what they paid for others) minus (what others paid for them), adjusted by confirmed payments, over unsettled expenses only.
5. **Settle-up suggestions** must use the **fewest possible payments**, found with an exact subset (bitmask) search, not a greedy match. Groups are capped at `MAX_GROUP_MEMBERS = 12` so this stays fast. Outside an open settle-up, suggestions are recalculated after every confirmed direct payment.
6. **Access** (one helper, `requireGroupAccess`, used everywhere):
   - Current members can read and write.
   - Former members can only **read** data created **before** their `left_at`.
   - Everyone else gets `403`. A personal space is visible only to its owner and cannot have invitations.
7. **Editing:** only the payer can edit or delete an expense, and only while it is unsettled. The payer can't be changed; to fix a wrong payer, delete the expense and add it again. Settled expenses are locked: editing or deleting one is `409`, and anyone but the payer gets `403`. An expense in an open settle-up (created on or before its `started_at`) is locked the same way until the period closes or the settle-up is cancelled, so the suggested payments stay true to the balances they came from. Unchecking a list item deletes its expense, so only the member who checked it off can uncheck it (`403` for anyone else), and a settled expense makes it `409`. A done item with no expense just reopens, and unchecking an item that is already open is `409`. A member who has left keeps the balance they left with, since they can no longer settle: a new cost can't include them, and an expense with a non-zero share of theirs is locked like a settled one until a settle-up claims it, so editing it, even its description, deleting it or unchecking its item is `409`.
8. **Leaving:** a member can leave only with a zero balance and no payment to or from them still suggested or paid, since nobody could confirm it after they leave (`409`). A personal space can't be left (`403`). A group with one member keeps working; when the last member leaves, set `archived_at` and make it read-only.
9. **Payments** are records of money sent outside the app. The app never moves money.
10. **Settle-up periods:** a settle-up works on the balances at the moment it starts: the app takes a cut-off from the database clock, reads the balances up to it, and `start_settlement` checks them against its own before storing the cut-off as `started_at`. A settle-up can't start while a direct payment in the group is still `paid` and not confirmed (`409`): it counts in no balance yet, so the settle-up would suggest the same money again; it can start once the recipient confirms or declines it. Expenses and direct payments added while it is open belong to the next period, and the expenses in the period can't be edited or deleted until it closes (6.7). Any current member can cancel it while every payment in it is still suggested; once one is marked paid, it can only close, unless its recipient declines it. The recipient of a paid payment can decline it (“I didn’t get it”): a settle-up payment goes back to suggested with `paid_at` cleared, so the payer can mark it again; a direct payment, which never counted in a balance, is deleted.

---

## 7. Scrum and Git workflow

_Why: The board, branches and PRs keep two partners and their agents from overlapping, and Project 2 grades this history._

- Board: Backlog → Sprint Todo → In Progress → In Review → Done. One issue per piece of work, on the [issue board](https://github.com/blouyakis/cs6983-project-2/issues).
- Product Owner and Scrum Master rotate each sprint.
- Branch from `main`: `feature/19-settle-up`. One branch per issue.
- Commits: `feat(settle): summary (#19)`. Each commit should build.
- PRs include `Closes #<issue>` and how it was tested. One partner approval, green CI, merge commit.
- Every `TODO` names an issue: `// TODO(#21): show past periods once settlements are stored`.
- An agent may branch, write tests and code, commit, and draft a PR. It may not push `main`, merge, close or relabel issues, change CI or branch protection, or edit a merged migration.

---

## 8. Do’s and don’ts

_Why: These are the mistakes an agent is most likely to make in this stack, plus the security and accessibility rules the app must meet._

### Do

- Add a SQL migration for every schema change (`npx supabase migration new <name>`).
- Let the database set `updated_at`. A trigger sets it on every update, so services never write it.
- Take every time written to the database from the database's clock: `now()` in SQL, or `db_now()` read just before a write through `supabase-js` (`dbNow()` in `lib/db/settlements.ts` and in `supabase/tests/fixtures.ts`). This covers the database tests too. `new Date()` is still fine for a time that is only shown or used to pick a date range, never written.
- Update [docs/api/openapi.yaml](docs/api/openapi.yaml) in the same PR as any API change.
- Follow [DESIGN.md](DESIGN.md) for UI work.

### Don't

- Don't recalculate balances in the browser.
- Don't use the Pages Router, `getServerSideProps`, `tailwind.config.js`, an ORM, a global state library, a UI kit, `axios`, `moment`, or `lodash`.
- Don't add a dependency without saying why in the PR.
- Don't build Won't Have items from the PRD. Real-time is Could Have; ask before starting it.
- Don't edit tests to match broken behavior.
- Don't return the JWT in a response body or accept it from an `Authorization` header. The `session` cookie is the only transport.

### Preferred libraries

Prefer the stack in Section 1, plus `server-only`, `@testing-library/react`, `@playwright/test`, and `swagger-ui-react`.

### Security requirements

Non-negotiable values, check them before opening a PR: bcrypt cost **12** · session expiry **24 h** · cookie `httpOnly` + `Secure` (always, including dev) + `SameSite=Lax`, named `session` · password minimum **8** characters · emails stored **lowercase**.

- Hash passwords with `bcryptjs` (cost factor 12). Passwords must be at least 8 characters. Store emails lowercase.
- Store the JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie named `session`. Tokens expire after 24 hours; expired tokens get `401` and the user is sent to login.
- Never store tokens in `localStorage` and never send the service role key or JWT secret to the browser.
- Protect pages in `proxy.ts` and check the session again in every route handler. Never trust a user id sent by the client; always use the one from the session.
- The routes in `PUBLIC_API_ROUTES` in `proxy.ts` (register, login, logout, `GET /api/health` and the `/api/docs` page) skip the session check on purpose: none of them acts for a signed-in user. Register and login return only the user who just sent their credentials, logout only clears the cookie, `GET /api/health` reads no user data, and `/api/docs` shows only the OpenAPI spec, which is in the repository anyway. A new public route goes in that list and must not return any data that needs a session to see.
- Check group access in the service layer on every request (Section 6.6).
- Enable Row Level Security on every table with no public policies, so only our server (with the service role key) can read or write.
- Never log passwords, tokens or full request bodies. Return generic messages for login failures (“Email or password is incorrect.”).
- Keep secrets in `.env.local`, Vercel and GitHub secrets. Never commit `.env*` files except `.env.example`.

### Accessibility requirements (WCAG 2.1 AA)

- Use semantic HTML: real `<button>`, `<a>`, `<label>`, headings in order, and lists for lists.
- Every input has a visible label. Errors appear next to the field and are announced with `aria-live="polite"`.
- Everything works with a keyboard alone, with a visible focus style.
- Text contrast is at least 4.5:1. Never use color alone to show meaning; owing and being owed are always written out in words.
- Dialogs trap focus and close with Escape.
- Respect `prefers-reduced-motion`.

---

## Changelog

- 2026-11-12, Ziye: added `sprint-3/ retrospective` to the `docs/sprints/` line of the folder tree in Section 2, and removed `docs/decisions/ (planned)` with the note about planned paths (#103). The Sprint 3 retrospective now exists, and `docs/decisions/` was never created because the decisions are in architecture.md Section 8, so at the end of the project the tree describes what is there rather than what might be.
- 2026-11-11, Ziye: added the `/api/docs` page to the public routes in Section 8, and said in Section 1 that `npm run lint` also checks `docs/api/openapi.yaml` with Redocly (#16). The docs have to open without logging in, so an agent or reviewer reading the old list of four would take the page for a missing session check. The spec check went into `npm run lint` instead of a new CI job, so CI's lint job runs it without a change to `ci.yml`, which an agent may not edit.
- 2026-11-10, Barbara: said in Section 6.10 that a settle-up can't start while a direct payment in the group is still `paid` and not confirmed (#112). Ziye's review of #107 showed that balances count only confirmed payments, so a settle-up started while Ana's $8.83 to Sam was waiting suggested "Ana → Sam $8.83" again, and Ana would pay twice. Refusing in `start_settlement` was chosen over showing the pending payment on the settle-up page, because a note can be missed and a refusal can't.
- 2026-11-08, Ziye: said in Section 6.10 that the recipient of a paid payment can decline it, which puts a settle-up payment back to suggested and deletes a direct payment (#108). Without it, a settle-up whose recipient never confirmed a paid payment could neither close nor be cancelled, so its expenses stayed locked and no new settle-up could start. Since #112, declining also clears a direct payment that keeps a settle-up from starting. A declined direct payment is deleted rather than given a `declined` status, because it never counted in a balance and a declined settle-up payment keeps no trace either; architecture.md's "Payment lifecycle" has the reasoning.
- 2026-11-08, Ziye: said in Section 6.7 that a new cost can't include a member who has left and that an expense with a non-zero share of theirs is locked like a settled one, and in Section 6.8 that a member can't leave while a payment to or from them is suggested or paid, or leave a personal space (#22). Leaving at zero is only safe if the balance stays zero afterwards: without the first, a payer could delete or edit a cost the former member shared and leave them owing or owed with no way to settle; without the second, a payment nobody can confirm would never count. The lock covers every edit, not only the ones that change their share, because the edit form only knows the current members, so any save of such an expense would fail (#22 review).
- 2026-11-08, Ziye: said in Section 8 that every time written to the database comes from the database's clock (#121). `markPaymentPaid` stamped `paid_at` with the app server's clock while `confirm_payment` stamps `confirmed_at` with the database's, so a server clock running ahead made a quick confirm break `payments_confirmed_after_paid` and fail with a 500. It is the same bug #75 fixed for membership times and #14 avoided for direct payments, so it needs a rule, not another one-off fix.
- 2026-11-08, Ziye: said in Section 8 that the routes in `PUBLIC_API_ROUTES` skip the session check because none of them acts for a signed-in user, and that a new public route goes in that list and must not return data that needs a session (#115). The rule said every route handler checks the session, so an agent or reviewer would take these four routes for a missing check, and a session check on `/api/health` would break it for an uptime monitor.
- 2026-11-07, Ziye: added `sprint-3/ planning` to the `docs/sprints/` line of the folder tree in Section 2 (#99), because the Sprint 3 planning notes now exist there, written at the start of the sprint rather than three days in like Sprint 2's.
- 2026-11-06, Barbara: added `sprint-2/ retrospective` to the `docs/sprints/` line of the folder tree in Section 2 (#18), recording the end-of-sprint metrics and lessons learned, and said in Section 4 that `e2e/accessibility.spec.ts` checks every main page and form, and that a new page goes into it. The tree was missing `docs/hw3/`, and without the rule a page added in Sprint 3 would skip the WCAG check that the other pages pass.
- 2026-11-05, Barbara: said in Section 6.7 that an expense in an open settle-up is locked like a settled one, and in Section 6.10 how the balances and `started_at` are taken from the same moment (#86). Ziye's review of #82 showed that without the first, an edit during a settle-up left the period's balances non-zero at close, and without the second, a cost added between reading the balances and starting could be settled without ever being paid.
- 2026-11-04, Barbara: added `sprint-2/ planning` to the `docs/sprints/` line of the folder tree in Section 2 (#67), because the Sprint 2 planning notes now exist there. The notes were late: the Sprint 1 retrospective asked for them on 2026-10-31.
- 2026-11-03, Ziye: said in Section 6.3 that a default share weight is a whole number from 1 to 100 (#6). Without a cap, a weight like 10⁹ makes `amount × total weight` unsafe in `splitByWeights`, which turns into a 500; the cap was only in architecture.md, and an agent reads this file first.
- 2026-11-02, Ziye: said in Section 6.3 that a group's ratio reaches an expense through `SplitEditor` opening on Custom amounts, and that the server's even mode is always 1:1 (#8). The old sentence read as if the server applied the ratio, so an API client or an agent could expect `mode: "even"` in a 60/40 group to split 60/40, when it splits 50/50.
- 2026-10-31, Ziye: let the member who checked off a list item uncheck it in user flow 2 and Section 6.7, which deletes its expense and reopens the item while the expense is unsettled. An item checked off by mistake needed an undo, and it follows the same rules as deleting the expense. Section 6.7 also states the `403` and `409` codes, an item with no expense, and an item that is already open, because before this they were only in architecture.md, and an agent reads this file first.
- 2026-10-31, Ziye: said in Section 6.2 that the payer is always a sharer, with the example of a cost paid only for others, and removed `(planned)` from `lib/domain` in Section 2 (#8). Without the first, an even split of a cost the payer doesn't share has nowhere to put the leftover cent; the second is because `lib/domain/splits.ts` now exists.
- 2026-10-30, Barbara: updated the folder structure in Section 2 to what exists after Sprint 1 (#47): `proxy.ts`, `components/`, `lib/auth`, `http`, `services`, `validation`, `supabase/seed.sql` and `docs/sprints/`. Only `docs/decisions/` and `lib/domain` are still planned. The old tree said the scaffold page was the only page and marked those paths as planned, so an agent would have recreated files that already exist.
- 2026-10-30, Barbara: moved the stack from Node 24 to Node 26 in Section 1, `.nvmrc`, `engines` and `@types/node`, because Node 26 became the LTS release on 2026-10-28 and Node 24 entered maintenance on 2026-10-20. Vercel supports 26.x, and the tests, build and Playwright flows pass on it.
<!-- Add one line per change: date, who, what, and why. This history is part of the HW3 refinement deliverable. -->

- 2026-10-30, Barbara: put the security numbers in one checklist line at the top of Section 8, because the no-rules run on #4 picked the library defaults for every value the prose didn't make prominent: bcrypt cost 10, a 7-day cookie, and `Secure` only in production. See [docs/sprints/issue-4-comparison.md](docs/sprints/issue-4-comparison.md).
- 2026-10-30, Barbara: added a Don't about returning the JWT in the body or reading it from an `Authorization` header, because the no-rules run on #4 did both; the old rule only covered `localStorage` in the browser.
- 2026-10-30, Barbara: said in Section 3 that `lib/db` is where `snake_case` becomes `camelCase`, because the no-rules run on #4 sent `created_at` to the client; the rule named both casings but not where the conversion happens.
- 2026-10-30, Barbara: added a `git diff --cached --stat` check before `test(...)` commits in Section 4, because one of the ten test commits in the with-rules run on #4 (`e492056`) also carried `app/(app)/page.tsx`.
- 2026-10-29, Ziye: added the `updated_at` rule to Section 8 (#3). Barbara asked us to pick one way to keep it current, and a trigger can't be forgotten by a service.
- 2026-10-29, Ziye: added `npm run test:db` and `supabase/tests/`, named `@supabase/supabase-js` and the pinned Supabase CLI in Section 1, and marked `supabase/migrations/` and `lib/db` as existing (#3). Database rules can only be tested against a real Postgres, and CI now runs those tests.
- 2026-10-29, Barbara: switched [DESIGN.md](DESIGN.md) to the colors and components of the new mockups, and ruled in Section 6.7 that the payer can't be changed when editing, because the new edit mockup showed a payer picker the rules didn't cover.
- 2026-10-29, Ziye: added settle-up periods to Section 6 and pointed at the final schema in [docs/architecture.md](docs/architecture.md) (#3). The team decided that costs added during an open settle-up go to the next period, and that any member can cancel it until someone marks a payment paid.
- 2026-10-29, Barbara: described each UI component in [DESIGN.md](DESIGN.md) with its expected behavior (PR #29), because the screens were described but only two components were.
- 2026-10-29, Barbara: added a one-line _Why_ note under each numbered section, so agents and reviewers know the reason behind each group of rules. The notes are visible text because Claude Code strips HTML comments from this file.
- 2026-10-29, Barbara: labeled the folder structure as the target structure and marked the paths that don't exist yet, so agents don't assume `src/proxy.ts`, `lib/` or migrations are already there.
- 2026-10-28, Ziye: pointed agents at the installed Next.js 16 docs in `node_modules/next/dist/docs/01-app`, because `agentRules` is off and Next no longer writes that pointer.
- 2026-10-28, Ziye: added Prettier beside ESLint because issue #1 requires both, and `npm run lint` now checks formatting.
- 2026-10-28, Ziye: moved the issues link to Section 7, and added [docs/user-stories.md](docs/user-stories.md) from the shared user-story doc, linked in Section 5.
- 2026-10-28, Ziye: linked the docs that already exist so those paths open directly.
- 2026-10-28, Ziye: added the LifeBoard mockups in [docs/design/](docs/design/) and the colors sampled from them in [DESIGN.md](DESIGN.md).
- 2026-10-28, Ziye: moved ListItemRow and MoneyText into [DESIGN.md](DESIGN.md).
- 2026-10-28, Ziye: working name is LifeBoard.
- 2026-10-28, Ziye: shortened this file to the rules an agent needs on every request. The route list is now [docs/api/openapi.yaml](docs/api/openapi.yaml), the draft schema is [docs/architecture.md](docs/architecture.md), and the PRD is [docs/PRD.md](docs/PRD.md).
- 2026-10-26, Ziye: chose `swagger-ui-react` for the API docs page (#16).
- 2026-10-26, Ziye: first draft. Mockups and the final schema are still open.
