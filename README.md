# LifeBoard

Your everyday plans and costs, alone or together.

**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang ([@SeraphimHuang](https://github.com/SeraphimHuang))

## Status

**Sprint 1 is complete, and Sprint 2 is done apart from four follow-ups** ([#69](https://github.com/blouyakis/cs6983-project-2/issues/69), [#88](https://github.com/blouyakis/cs6983-project-2/issues/88), [#89](https://github.com/blouyakis/cs6983-project-2/issues/89), [#90](https://github.com/blouyakis/cs6983-project-2/issues/90)). Sprint 1 built the scaffold ([#1](https://github.com/blouyakis/cs6983-project-2/issues/1)), CI/CD ([#2](https://github.com/blouyakis/cs6983-project-2/issues/2)), the database ([#3](https://github.com/blouyakis/cs6983-project-2/issues/3)), accounts ([#4](https://github.com/blouyakis/cs6983-project-2/issues/4)) and access control ([#5](https://github.com/blouyakis/cs6983-project-2/issues/5)). Sprint 2 built groups, expenses, splits, balances, the overview, lists, editing expenses, the settle-up, the personal space and the Lists and Settle up pages. Sprint 3 is the remaining Should Haves, the API docs, the end-to-end suite and the final polish ([#18](https://github.com/blouyakis/cs6983-project-2/issues/18)). See the [Sprint 1 retrospective](./docs/sprints/sprint-1/retrospective.md) and the [Sprint 2 retrospective](./docs/sprints/sprint-2/retrospective.md).

| | |
|---|---|
| **Production URL** | <https://cs6983-project-2.vercel.app> (from `main`) |
| **API docs (Swagger)** | Swagger UI at `/api/docs` is planned in [#16](https://github.com/blouyakis/cs6983-project-2/issues/16). The spec is [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) |
| **Issues and milestones** | [Issues](https://github.com/blouyakis/cs6983-project-2/issues) · [Milestones](https://github.com/blouyakis/cs6983-project-2/milestones) |
| **Project board** | [LifeBoard board](https://github.com/users/blouyakis/projects/3) (Backlog → Sprint ToDo → In Progress → In Review → Done) |
| **PRD** | [`docs/PRD.md`](./docs/PRD.md) |
| **Demo video** | Due with the final submission |

---

## Overview

LifeBoard is a web app for planning and paying for everyday life, alone or with others. Every user has a **personal space** with their own list and spending. Users also create **groups** for any part of life, such as a dorm, a weekend picnic, or date nights. Members share one list and one ledger.

Checking off a list item records what it cost and who shares it. Costs that were never on the list can be added directly. Each group shows who owes whom, and a settle-up suggests the fewest payments that clear every balance. One overview shows personal spending, your share in each group, and what you owe or are owed.

### Who it's for

Roommates sharing a dorm or apartment, partners sharing a home, friends planning outings, co-parents splitting childcare costs, and anyone who wants to track their own plans and spending in the same place.

User stories are in [`docs/user-stories.md`](./docs/user-stories.md). Priorities are in the [PRD](./docs/PRD.md). Acceptance criteria for each piece of work are on its [GitHub issue](https://github.com/blouyakis/cs6983-project-2/issues).

## Features

The list follows the PRD's priorities. **Built** means it is on `main`; the rest is planned in the issue shown.

**Must have**

- **Accounts (built, [#4](https://github.com/blouyakis/cs6983-project-2/issues/4)):** register with email and password, log in with an expiring JWT, log out
- **Access control (built, [#5](https://github.com/blouyakis/cs6983-project-2/issues/5)):** users only read or change data in groups they belong to. API requests without a session get `401`, and `requireGroupAccess` gives `403` to anyone outside a group
- **Groups and invitations (built, [#6](https://github.com/blouyakis/cs6983-project-2/issues/6)):** create a group for any part of life, invite members by email, and see your groups on the Groups page. A former member who is invited again rejoins
- **Lists (partly built):** add, edit and delete things to do or buy, with an optional estimate and a running total, in a group or the personal space ([#11](https://github.com/blouyakis/cs6983-project-2/issues/11), [#23](https://github.com/blouyakis/cs6983-project-2/issues/23)); the Lists page picks which one. Checking an item off with the actual cost and who shares it is [#12](https://github.com/blouyakis/cs6983-project-2/issues/12) ([#13](https://github.com/blouyakis/cs6983-project-2/issues/13) was folded into it)
- **Expenses (built, [#7](https://github.com/blouyakis/cs6983-project-2/issues/7), [#8](https://github.com/blouyakis/cs6983-project-2/issues/8), [#20](https://github.com/blouyakis/cs6983-project-2/issues/20)):** log personal or group costs, split evenly or by custom amounts, and edit or delete until settled
- **Balances (built, [#9](https://github.com/blouyakis/cs6983-project-2/issues/9)):** each member's net balance across unsettled expenses and confirmed payments, computed on the server per request, shown in words on the group page and served by `GET /api/groups/{groupId}/balances`
- **Settle-up (built, [#19](https://github.com/blouyakis/cs6983-project-2/issues/19)):** any member starts a settle-up on the balances at that moment, the app suggests the fewest payments that clear every balance (an exact subset search in `src/lib/domain/settle-up.ts`), the payer marks each one paid, the recipient confirms it, and when the last is confirmed the period closes and its expenses are locked. On `/groups/{groupId}/settle-up`; the Settle up page ([#68](https://github.com/blouyakis/cs6983-project-2/issues/68)) lists your groups with your balance and opens that screen
- **Overview (built, [#10](https://github.com/blouyakis/cs6983-project-2/issues/10)):** personal total, share in each group, and net balance across groups

**Should have:** estimated costs on list items ([#11](https://github.com/blouyakis/cs6983-project-2/issues/11)), direct payments between two members ([#14](https://github.com/blouyakis/cs6983-project-2/issues/14)), an itemized bill per member ([#21](https://github.com/blouyakis/cs6983-project-2/issues/21)), leaving a group with read-only history ([#22](https://github.com/blouyakis/cs6983-project-2/issues/22)), a default split ratio ([#8](https://github.com/blouyakis/cs6983-project-2/issues/8) splits by it and [#6](https://github.com/blouyakis/cs6983-project-2/issues/6) stores it; the screen to set it is [#63](https://github.com/blouyakis/cs6983-project-2/issues/63)), and filters by group, person, and date ([#15](https://github.com/blouyakis/cs6983-project-2/issues/15)).

**Could have:** CSV export of a group's history and real-time updates.

### Out of scope

Recurring bills, a group activity log, group messaging, disputing charges, group admin roles, in-app payments, a map of past outings, and AI features. Reasons are in the [PRD](./docs/PRD.md).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 |
| Backend | Next.js route handlers · Zod validation |
| Database | Supabase Postgres, used only as a database, through `@supabase/supabase-js` (no ORM) |
| Auth | Our own JWT with `jose` · `bcryptjs` password hashing |
| Testing | Vitest (unit and integration) · Playwright (E2E) |
| API docs | OpenAPI 3 · `swagger-ui-react` |
| CI/CD | GitHub Actions · Vercel (preview per PR, production from `main`) |
| AI harness | Guided by [`AGENTS.md`](./AGENTS.md) |

## Architecture

Diagrams of the system, its layers, and a request are in [`docs/architecture.md`](./docs/architecture.md).

```text
.
├── AGENTS.md              # shared rules for AI coding tools
├── DESIGN.md              # colors, screens, and UI components
├── README.md
├── LICENSE
├── .env.example
├── .nvmrc                 # Node 26
├── e2e/                   # Playwright: user flows and the accessibility checks
├── src/proxy.ts           # first check on every request: 401 for the API, redirect to /login for pages
├── src/app/               # App Router: (auth) login and register, (app) overview, lists, settle up and groups, api routes
├── src/components/        # ui/ primitives, and auth/, groups/, expenses/, lists/, overview/ and settle-up/ feature folders
├── src/lib/               # auth, db (the only Supabase client), domain, http, services, validation
├── supabase/
│   ├── migrations/        # SQL migrations
│   ├── seed.sql           # demo data for local development
│   └── tests/             # database tests (npm run test:db)
└── docs/
    ├── PRD.md
    ├── user-stories.md
    ├── architecture.md    # system, layers, and schema
    ├── api/openapi.yaml
    ├── design/            # mockup screenshots
    ├── research/          # project proposal
    └── sprints/           # sprint-1/, sprint-2/ planning and retrospective, HW3 before/after test
```

`src/lib/domain/` holds the money rules as pure functions: splits ([#8](https://github.com/blouyakis/cs6983-project-2/issues/8)), balances ([#9](https://github.com/blouyakis/cs6983-project-2/issues/9)) and settle-up ([#19](https://github.com/blouyakis/cs6983-project-2/issues/19)). The layout rules are in [`AGENTS.md`](./AGENTS.md) Section 2, and the diagrams of the system, its layers and a request are in [`docs/architecture.md`](./docs/architecture.md).

### Database schema

The ER diagram and table definitions are in [`docs/architecture.md`](./docs/architecture.md) Section 5: `users`, `groups`, `group_members`, `list_items`, `expenses`, `expense_shares`, `payments`, and `settlements`. Issue [#3](https://github.com/blouyakis/cs6983-project-2/issues/3) turned them into SQL migrations in `supabase/migrations/`. Every table has Row Level Security on and no policies, so only the server, with the service role key, can read or write.

## Getting started

These steps run the app against a local Supabase database. Use Chrome or Firefox for local development (#58).

### Prerequisites

- Node.js 26 and npm. If you use nvm, `nvm use` reads `.nvmrc`.
- Docker, for local Supabase and `npm run test:db`

### Run locally

```bash
git clone git@github.com:blouyakis/cs6983-project-2.git
cd cs6983-project-2
nvm use                      # if you use nvm
npm ci
npx playwright install chromium
cp .env.example .env.local   # then fill it in, see Database and Environment variables
npx supabase start -x studio,postgres-meta   # local database, needs Docker
npx supabase db reset        # apply all migrations, then load the demo data
npm run dev                  # http://localhost:3000
```

### Database

Login, registration and the database tests need local Supabase (the `start` and `db reset` lines above). `npx supabase status` prints the values for `SUPABASE_URL` (`API_URL`) and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. For `JWT_SECRET`, use `openssl rand -base64 32`.

**Applying migrations to the hosted database.** When a PR adds a new SQL migration in `supabase/migrations/`, a partner must apply it to the hosted Supabase project **before the PR is merged**. Vercel deploys from `main` on every merge, so the migration must reach the hosted database first. See [`docs/architecture.md`](./docs/architecture.md) Section 7 for the commands and workflow.

### Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key |
| `JWT_SECRET` | Signing key for session tokens, at least 32 random characters |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app, e.g. `http://localhost:3000` |

### Demo account

After `npx supabase db reset`, log in locally as **`demo@lifeboard.test`** with the password **`lifeboard-demo`**. `sam@lifeboard.test` and `jo@lifeboard.test` use the same password. The three share a group called Flat with a few costs, a shopping list and a repayment, loaded from [`supabase/seed.sql`](./supabase/seed.sql).

## Testing

We follow **test-driven development**: the failing test is committed before the code, and that order is visible in the git history.

```bash
npm run lint          # ESLint, then Prettier check
npm run typecheck     # tsc --noEmit
npm test              # unit tests (Vitest)
npm run test:db       # database tests (Vitest), needs npx supabase start
npm run test:coverage # unit tests with coverage thresholds
npm run test:e2e      # Playwright, needs npx supabase start and a free port 3000
```

Playwright runs the user flows in [`AGENTS.md`](./AGENTS.md) Section 5 and the accessibility checks below. CI runs it in the `e2e` job, against a production build with local Supabase ([#17](https://github.com/blouyakis/cs6983-project-2/issues/17)). Run `npm run test:e2e` before opening a pull request that changes a page, since it is quicker to fix a failure locally than from the CI log.

`npm run test:coverage` fails below 80% of lines overall or 100% of `src/lib/domain`.

## CI/CD

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) ([#2](https://github.com/blouyakis/cs6983-project-2/issues/2)) runs on every pull request and on every push to `main`. The jobs are `install`, `lint`, `typecheck`, `test` (with coverage), `db-test` (local Supabase), `build`, and `audit`. `audit` fails on high or critical npm advisories.

Vercel builds a preview for each pull request and deploys `main` to production. The repository admin turns on branch protection for `main`: a pull request, one review, and these seven checks: `install`, `lint`, `typecheck`, `test`, `db-test`, `build` and `audit`. That setting is not part of the workflow file.

## Accessibility

Every page follows WCAG 2.1 AA and the rules in [`AGENTS.md`](./AGENTS.md) Section 8: semantic HTML, a visible label on every input, errors announced with `aria-live="polite"`, keyboard-only use with a visible focus style, text contrast of at least 4.5:1, owing and being owed written in words, dialogs that trap focus and close with Escape, and no animation under `prefers-reduced-motion`.

[`e2e/accessibility.spec.ts`](./e2e/accessibility.spec.ts) checks this in Playwright ([#18](https://github.com/blouyakis/cs6983-project-2/issues/18)), at desktop width and at 375px:

- `@axe-core/playwright` scans login, register, the overview, Lists, Groups, a group, Settle up, a group's settle-up and the open dialogs for WCAG 2.1 A and AA violations. It is a dev dependency because it is the one tool that runs the WCAG rules in a real browser, and it never ships to users.
- Each page fits a 375px screen with no sideways scroll.
- Tabbing through the login, register, new group, new entry and edit forms reaches every control and shows a focus style. A dialog keeps focus inside and closes with Escape.
- Transitions and animations are off under `prefers-reduced-motion`.

Automated checks find only part of the problems, so also try a page with the keyboard and a screen reader when you change it.

## Deploying

Production is <https://cs6983-project-2.vercel.app>, built by Vercel from `main`. To set up your own copy:

1. Create a Supabase project and apply the migrations to it: `npx supabase link --project-ref <ref>`, then `npx supabase db push`. Don't load `supabase/seed.sql`, because it holds demo accounts with a known password. How to do this for the team's project is tracked in [#69](https://github.com/blouyakis/cs6983-project-2/issues/69).
2. Import the repository into Vercel. The framework is detected as Next.js, and the Node version comes from `.nvmrc`.
3. Add the four variables from [Environment variables](#environment-variables) to the Vercel project, using the hosted project's URL and service role key, a new `JWT_SECRET`, and the production URL as `NEXT_PUBLIC_APP_URL`. Keep the service role key and `JWT_SECRET` server-side; never give them a `NEXT_PUBLIC_` prefix.
4. Every pull request gets a preview deployment, without a database ([#114](https://github.com/blouyakis/cs6983-project-2/issues/114)), and a merge to `main` deploys to production. A migration is applied to the hosted database with `npx supabase db push` before the code that needs it is merged.
5. Check the deployment at [`/api/health`](https://cs6983-project-2.vercel.app/api/health). It needs no login and answers `200` with `{ "status": "ok" }` when the app is up and can query the database, or `503` with `{ "status": "error" }` when it can't. It is never cached and says nothing else. It gives up on the database after 3 seconds, and why the database didn't answer goes to the Vercel function logs, starting with "Health check: the database did not answer."

## Development workflow

- **Branches:** one per issue, from `main`, e.g. `feature/19-settle-up`
- **Commits:** Conventional Commits with the issue number, e.g. `feat(settle): suggest fewest payments (#19)`
- **Pre-commit hook:** `npm install` sets up a Husky hook that runs `eslint --fix` and `prettier --write` on the staged files through lint-staged, and stops the commit if an ESLint error can't be fixed. CI and Vercel skip the hook, and CI's lint job still checks every file.
- **Pull requests:** `Closes #<issue>` and how it was tested; one partner approval and green CI; merged with a merge commit
- **Sprints:** three sprints tracked as GitHub milestones (`Sprint 1 v.01`, `Sprint 2 v.02`, `Sprint 3 v.03`)
- **Standups and meetings:** logged in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?gid=229896090#gid=229896090)
- **Planning and retrospectives:** in `docs/sprints/sprint-N/`, one folder per sprint

Full conventions are in [`AGENTS.md`](./AGENTS.md).

## API

Twenty-seven routes are implemented: `POST /api/auth/register`, `/login` and `/logout`, `GET /api/auth/me`, `GET /api/health`, `GET /api/overview`, `GET` and `POST /api/groups`, `GET` and `PATCH /api/groups/{groupId}`, and under `/api/groups/{groupId}`: `POST invitations`, `POST leave`, `GET balances`, `GET` and `POST expenses`, `PATCH` and `DELETE expenses/{expenseId}`, `GET` and `POST list-items`, `PATCH` and `DELETE list-items/{itemId}`, `GET` and `POST settlements`, `GET settlements/current`, `POST settlements/current/cancel`, and `POST payments/{paymentId}/paid` and `/confirm`. The full API is described in [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) and the routes not listed above are built issue by issue. Swagger UI will be served at `/api/docs` ([#16](https://github.com/blouyakis/cs6983-project-2/issues/16)).

Errors use one body, `{ "error": { "code", "message", "fields"? } }`. The session is an `httpOnly` cookie named `session`; the API never returns the token.

Main resources: `/api/auth`, `/api/health`, `/api/overview`, and `/api/groups/{groupId}` with `list-items`, `expenses`, `balances`, `bills/me`, `payments`, `settlements`, `invitations`, and `leave`.

## Project documentation

| Document | Location |
|---|---|
| Rules for AI coding tools | [`AGENTS.md`](./AGENTS.md) |
| PRD | [`docs/PRD.md`](./docs/PRD.md) |
| User stories | [`docs/user-stories.md`](./docs/user-stories.md) |
| Project proposal | [`docs/research/project-proposal.md`](./docs/research/project-proposal.md) |
| Design and mockups | [`DESIGN.md`](./DESIGN.md) · [`docs/design/`](./docs/design/) |
| Architecture and schema | [`docs/architecture.md`](./docs/architecture.md) |
| API spec | [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) |
| Sprint planning and retrospectives | [Sprint 1 retrospective](./docs/sprints/sprint-1/retrospective.md) · [Sprint 2 planning](./docs/sprints/sprint-2/planning.md) · [Sprint 2 retrospective](./docs/sprints/sprint-2/retrospective.md). Sprint 3 gets `docs/sprints/sprint-3/` when the sprint ends |
| Communication log | [Google Sheet](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?gid=229896090#gid=229896090) |
| Contribution log | [Contributors](#contributors) section below |
| HW3 submission (Scrum setup, rules file, before/after test, reflection) | [`docs/hw3/hw3-submission.md`](./docs/hw3/hw3-submission.md) |
| HW3 before/after test of `AGENTS.md`, in full | [`docs/sprints/issue-4-comparison.md`](./docs/sprints/issue-4-comparison.md) |

## Contributors

| Partner | Primary areas |
|---|---|
| Barbara Louyakis | **Project management:** the GitHub project board, the three milestones and issues [#1](<https://github.com/blouyakis/cs6983-project-2/issues/1>) to [#18](<https://github.com/blouyakis/cs6983-project-2/issues/18>), branch protection and the Vercel connection. **Design:** the LifeBoard and Sunny Ledger mockups and the `DESIGN.md` colors and components. **Features:** accounts and login ([#4](<https://github.com/blouyakis/cs6983-project-2/issues/4>)), route protection and group access ([#5](<https://github.com/blouyakis/cs6983-project-2/issues/5>)), and the Node 26 move ([#45](<https://github.com/blouyakis/cs6983-project-2/issues/45>)). **AI harness:** `CLAUDE.md`, maintaining `AGENTS.md`, the HW3 before/after test ([`docs/sprints/issue-4-comparison.md`](./docs/sprints/issue-4-comparison.md)), the Sprint 1 retrospective, and the Sprint 2 planning notes and retrospective. **Sprint 2 features:** expenses ([#7](https://github.com/blouyakis/cs6983-project-2/issues/7)), balances ([#9](https://github.com/blouyakis/cs6983-project-2/issues/9)), the app shell ([#53](https://github.com/blouyakis/cs6983-project-2/issues/53)), editing and deleting expenses ([#20](https://github.com/blouyakis/cs6983-project-2/issues/20)), the personal space on register ([#66](https://github.com/blouyakis/cs6983-project-2/issues/66)), the group settle-up with its race fixes ([#19](https://github.com/blouyakis/cs6983-project-2/issues/19), [#83](https://github.com/blouyakis/cs6983-project-2/issues/83), [#86](https://github.com/blouyakis/cs6983-project-2/issues/86)), the Lists and Settle up pages ([#68](https://github.com/blouyakis/cs6983-project-2/issues/68)), and the accessibility pass and final documentation ([#18](https://github.com/blouyakis/cs6983-project-2/issues/18)). |
| Ziye Huang | **Planning:** the PRD, user stories US-5 to US-8, the project proposal, issues [#19](<https://github.com/blouyakis/cs6983-project-2/issues/19>) to [#23](<https://github.com/blouyakis/cs6983-project-2/issues/23>), and the first drafts of `AGENTS.md` and `DESIGN.md`. **Engineering foundation:** the Next.js scaffold ([#1](<https://github.com/blouyakis/cs6983-project-2/issues/1>)), CI/CD with GitHub Actions ([#2](<https://github.com/blouyakis/cs6983-project-2/issues/2>)), and the database ([#3](<https://github.com/blouyakis/cs6983-project-2/issues/3>)): the architecture document, all eight tables as SQL migrations, `register_user` and `create_expense`, the 12-member cap, the seed data, and the database tests with their CI job. **Sprint 2 features:** groups and invitations ([#6](https://github.com/blouyakis/cs6983-project-2/issues/6)), splits ([#8](https://github.com/blouyakis/cs6983-project-2/issues/8)), the `FormSheet` ([#56](https://github.com/blouyakis/cs6983-project-2/issues/56)), list items and the confirm before deleting one ([#11](https://github.com/blouyakis/cs6983-project-2/issues/11), [#76](https://github.com/blouyakis/cs6983-project-2/issues/76)), the personal space ([#23](https://github.com/blouyakis/cs6983-project-2/issues/23)), the overview ([#10](https://github.com/blouyakis/cs6983-project-2/issues/10)), and the Safari login fix ([#58](https://github.com/blouyakis/cs6983-project-2/issues/58)). |

Both partners commit, review each other's pull requests, and maintain `AGENTS.md`. Of the 43 pull requests merged by 2026-11-06, 40 have the other partner's approval. Day-to-day coordination is in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?gid=229896090#gid=229896090).

## License

[MIT](./LICENSE)
