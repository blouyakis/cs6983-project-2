# LifeBoard

Your everyday plans and costs, alone or together.

**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang ([@SeraphimHuang](https://github.com/SeraphimHuang))

## Status

**Sprint 1 is complete.** The scaffold ([#1](https://github.com/blouyakis/cs6983-project-2/issues/1)), CI/CD ([#2](https://github.com/blouyakis/cs6983-project-2/issues/2)), the database ([#3](https://github.com/blouyakis/cs6983-project-2/issues/3)), accounts ([#4](https://github.com/blouyakis/cs6983-project-2/issues/4)) and access control ([#5](https://github.com/blouyakis/cs6983-project-2/issues/5)) are built and deployed. Sprint 2 starts on groups, expenses, splits and balances. See the [Sprint 1 retrospective](./docs/sprints/sprint-1/retrospective.md).

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
- **Groups and invitations ([#6](https://github.com/blouyakis/cs6983-project-2/issues/6)):** create a group for any part of life and invite members by email
- **Lists ([#11](https://github.com/blouyakis/cs6983-project-2/issues/11), [#12](https://github.com/blouyakis/cs6983-project-2/issues/12), [#13](https://github.com/blouyakis/cs6983-project-2/issues/13)):** add things to do or buy, and check them off with the actual cost and who shares it
- **Expenses ([#7](https://github.com/blouyakis/cs6983-project-2/issues/7), [#8](https://github.com/blouyakis/cs6983-project-2/issues/8), [#20](https://github.com/blouyakis/cs6983-project-2/issues/20)):** log personal or group costs, split evenly or by custom amounts, and edit or delete until settled
- **Balances ([#9](https://github.com/blouyakis/cs6983-project-2/issues/9)):** each member's net balance across unsettled expenses
- **Settle-up ([#19](https://github.com/blouyakis/cs6983-project-2/issues/19)):** the fewest payments that clear every balance, marked paid and confirmed by the recipient
- **Overview ([#10](https://github.com/blouyakis/cs6983-project-2/issues/10)):** personal total, share in each group, and net balance across groups

**Should have:** estimated costs on list items ([#11](https://github.com/blouyakis/cs6983-project-2/issues/11)), direct payments between two members ([#14](https://github.com/blouyakis/cs6983-project-2/issues/14)), an itemized bill per member ([#21](https://github.com/blouyakis/cs6983-project-2/issues/21)), leaving a group with read-only history ([#22](https://github.com/blouyakis/cs6983-project-2/issues/22)), a default split ratio ([#8](https://github.com/blouyakis/cs6983-project-2/issues/8)), and filters by group, person, and date ([#15](https://github.com/blouyakis/cs6983-project-2/issues/15)).

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
├── e2e/                   # Playwright
├── src/proxy.ts           # first check on every request: 401 for the API, redirect to /login for pages
├── src/app/               # App Router: (auth) login and register, (app) overview, api routes
├── src/components/        # ui/ primitives and auth/ forms
├── src/lib/               # auth, db (the only Supabase client), http, services, validation
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
    └── sprints/           # Sprint 1 retrospective, HW3 before/after test
```

`src/lib/domain/` (splits, balances, settle-up) arrives with the expense issues. The target layout is in [`AGENTS.md`](./AGENTS.md) Section 2.

### Database schema

The ER diagram and table definitions are in [`docs/architecture.md`](./docs/architecture.md) Section 5: `users`, `groups`, `group_members`, `list_items`, `expenses`, `expense_shares`, `payments`, and `settlements`. Issue [#3](https://github.com/blouyakis/cs6983-project-2/issues/3) turned them into SQL migrations in `supabase/migrations/`. Every table has Row Level Security on and no policies, so only the server, with the service role key, can read or write.

## Getting started

These steps run the app against a local Supabase database.

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
npm run test:e2e      # Playwright
```

`npm run test:coverage` fails below 80% of lines overall or 100% of `src/lib/domain`.

## CI/CD

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) ([#2](https://github.com/blouyakis/cs6983-project-2/issues/2)) runs on every pull request and on every push to `main`. The jobs are `install`, `lint`, `typecheck`, `test` (with coverage), `db-test` (local Supabase), `build`, and `audit`. `audit` fails on high or critical npm advisories.

Vercel builds a preview for each pull request and deploys `main` to production. The repository admin turns on branch protection for `main`: a pull request, one review, and these seven checks: `install`, `lint`, `typecheck`, `test`, `db-test`, `build` and `audit`. That setting is not part of the workflow file.

## Development workflow

- **Branches:** one per issue, from `main`, e.g. `feature/19-settle-up`
- **Commits:** Conventional Commits with the issue number, e.g. `feat(settle): suggest fewest payments (#19)`
- **Pull requests:** `Closes #<issue>` and how it was tested; one partner approval and green CI; merged with a merge commit
- **Sprints:** three sprints tracked as GitHub milestones (`Sprint 1 v.01`, `Sprint 2 v.02`, `Sprint 3 v.03`)
- **Standups and meetings:** logged in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?gid=229896090#gid=229896090)
- **Planning and retrospectives:** in `docs/sprints/`, starting with the [Sprint 1 retrospective](./docs/sprints/sprint-1/retrospective.md)

Full conventions are in [`AGENTS.md`](./AGENTS.md).

## API

Five routes are implemented: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` and `GET /api/groups/{groupId}`. The rest of the REST API is described in [`docs/api/openapi.yaml`](./docs/api/openapi.yaml) and is built issue by issue. Swagger UI will be served at `/api/docs` ([#16](https://github.com/blouyakis/cs6983-project-2/issues/16)).

Errors use one body, `{ "error": { "code", "message", "fields"? } }`. The session is an `httpOnly` cookie named `session`; the API never returns the token.

Main resources: `/api/auth`, `/api/overview`, and `/api/groups/{groupId}` with `list-items`, `expenses`, `balances`, `bills/me`, `payments`, `settlements`, `invitations`, and `leave`.

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
| Sprint planning and retrospectives | [`docs/sprints/sprint-1/retrospective.md`](./docs/sprints/sprint-1/retrospective.md) |
| Communication log | [Google Sheet](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?gid=229896090#gid=229896090) |
| Contribution log | Not started (`docs/contributions.md`) |
| HW3 before/after test of `AGENTS.md` | [`docs/sprints/issue-4-comparison.md`](./docs/sprints/issue-4-comparison.md) |

## Contributors

| Partner | Primary areas |
|---|---|
| Barbara Louyakis | Accounts and login ([#4](https://github.com/blouyakis/cs6983-project-2/issues/4)), route protection and group access ([#5](https://github.com/blouyakis/cs6983-project-2/issues/5)), the DESIGN.md components and mockups, `AGENTS.md` and `CLAUDE.md` and the HW3 before/after test, the Node 26 move ([#45](https://github.com/blouyakis/cs6983-project-2/issues/45)) |
| Ziye Huang | Project scaffold ([#1](https://github.com/blouyakis/cs6983-project-2/issues/1)), CI/CD ([#2](https://github.com/blouyakis/cs6983-project-2/issues/2)), database schema, migrations, seed data and database tests ([#3](https://github.com/blouyakis/cs6983-project-2/issues/3)), the architecture document, the first draft of the planning docs |

Both partners commit, review, and maintain `AGENTS.md`.

## License

[MIT](./LICENSE)
