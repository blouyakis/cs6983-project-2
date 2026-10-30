# AGENTS.md

## 0. How to use this file

You are working on **LifeBoard**, a web app for planning and paying for everyday life, alone or with others. This file overrides your habits. If it disagrees with the PRD, stop and ask. Change it in a PR, and add a Changelog line.

---

## 1. Tech stack and versions

_Why: CI and Vercel build with exactly these versions. Next.js 16 changed APIs that older examples still use, so code written from memory often breaks._

- Node.js 24, Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, Supabase Postgres (database only), `jose`, `bcryptjs`, Zod 4, Vitest, Playwright, Prettier, OpenAPI 3, npm, Vercel, GitHub Actions

Before writing Next.js code, read the matching page in `node_modules/next/dist/docs/01-app`. Those pages match the installed Next.js 16. This file still wins if they disagree. Do not follow `02-pages`; the Pages Router is forbidden.

### Commands

```bash
npm run dev            # start the dev server
npm run lint           # ESLint, then Prettier check
npm run format         # Prettier write
npm run typecheck      # tsc --noEmit
npm test               # Vitest (unit + integration)
npm run test:coverage  # Vitest with coverage report
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

This is the **target structure**. Paths marked `(planned)` do not exist yet; create them there when the first issue needs them.

```text
.
├── AGENTS.md
├── README.md
├── DESIGN.md
├── .env.example
├── .github/workflows/ci.yml
├── docs/
│   ├── PRD.md
│   ├── user-stories.md
│   ├── architecture.md
│   ├── research/ design/
│   ├── decisions/           # (planned)
│   ├── api/openapi.yaml
│   └── sprints/sprint-1/    # (planned)
├── supabase/migrations/     # (planned)
├── e2e/
└── src/
    ├── proxy.ts             # (planned)
    ├── app/                 # (auth), (app), api — only the scaffold page exists so far
    ├── components/          # (planned) ui/ and feature folders
    └── lib/                 # (planned) domain, services, db, auth, validation, http
```

### Key patterns

- Server Components by default. `"use client"` only for state, effects, or event handlers.
- Code flows route handler → service → domain and db. Zod at the boundary. Only `lib/db` talks to Supabase.
- Routes, the error shape, and status codes are in [docs/api/openapi.yaml](docs/api/openapi.yaml). The draft schema is in [docs/architecture.md](docs/architecture.md).

---

## 3. Naming conventions and coding standards

_Why: Both partners and every agent write code the same way, so reviews can focus on behavior instead of style._

- Components: PascalCase, one per file. Other TypeScript files: kebab-case. Tests sit next to the code.
- API routes: plural kebab-case. JSON keys: camelCase. Database: plural snake_case. Money fields end in `Cents`; timestamps end in `At`.
- TypeScript `strict`, no `any`. Named exports, except `page.tsx` and `layout.tsx`. Services throw typed errors from `lib/http/errors.ts`.

---

## 4. Testing strategy

_Why: Project 2 grades test-driven development from the git history, and money bugs are easy to miss without tests._

- Vitest for unit and integration tests, Playwright for the flows in Section 5. Coverage: 80% lines, 100% of `lib/domain`.
- Commit the failing test first, then the code, then the refactor. Never in the same commit.

---

## 5. PRD and design references

_Why: The PRD and mockups decide what to build. These flows turn them into steps an agent can follow and Playwright can test._

- PRD: [docs/PRD.md](docs/PRD.md). User stories: [docs/user-stories.md](docs/user-stories.md).
- UI work follows [DESIGN.md](DESIGN.md). Mockups are in [docs/design/](docs/design/).

### User flows

These are also the Playwright scenarios.

1. **Sign up and first group:** register → land on the overview with an empty personal space → create a group → invite a member by email.
2. **Plan and buy:** add items to a group list → check one off → enter the actual cost and pick who shares it (default: everyone) → an expense is created with the current user as payer → every sharer’s balance updates → the item shows who completed it, the cost and when.
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
2. **Even splits:** divide in cents; any leftover cents go to the **payer’s** share. Shares must always add up exactly to the expense total.
3. **Custom splits** must add up to the total, or the request is rejected. A group’s default split ratio applies to new expenses and can be overridden per expense.
4. **Balances:** a member’s balance is (what they paid for others) minus (what others paid for them), adjusted by confirmed payments, over unsettled expenses only.
5. **Settle-up suggestions** must use the **fewest possible payments**, found with an exact subset (bitmask) search, not a greedy match. Groups are capped at `MAX_GROUP_MEMBERS = 12` so this stays fast. Suggestions are recalculated after every confirmed direct payment.
6. **Access** (one helper, `requireGroupAccess`, used everywhere):
   - Current members can read and write.
   - Former members can only **read** data created **before** their `left_at`.
   - Everyone else gets `403`. A personal space is visible only to its owner and cannot have invitations.
7. **Editing:** only the payer can edit or delete an expense, and only while it is unsettled. Settled expenses are locked.
8. **Leaving:** a member can leave only with a zero balance. A group with one member keeps working; when the last member leaves, set `archived_at` and make it read-only.
9. **Payments** are records of money sent outside the app. The app never moves money.

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
- Update [docs/api/openapi.yaml](docs/api/openapi.yaml) in the same PR as any API change.
- Follow [DESIGN.md](DESIGN.md) for UI work.

### Don't

- Don't recalculate balances in the browser.
- Don't use the Pages Router, `getServerSideProps`, `tailwind.config.js`, an ORM, a global state library, a UI kit, `axios`, `moment`, or `lodash`.
- Don't add a dependency without saying why in the PR.
- Don't build Won't Have items from the PRD. Real-time is Could Have; ask before starting it.
- Don't edit tests to match broken behavior.

### Preferred libraries

Prefer the stack in Section 1, plus `server-only`, `@testing-library/react`, `@playwright/test`, and `swagger-ui-react`.

### Security requirements

- Hash passwords with `bcryptjs` (cost factor 12). Passwords must be at least 8 characters. Store emails lowercase.
- Store the JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie named `session`. Tokens expire after 24 hours; expired tokens get `401` and the user is sent to login.
- Never store tokens in `localStorage` and never send the service role key or JWT secret to the browser.
- Protect pages in `proxy.ts` and check the session again in every route handler. Never trust a user id sent by the client; always use the one from the session.
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

<!-- Add one line per change: date, who, what, and why. This history is part of the HW3 refinement deliverable. -->

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
