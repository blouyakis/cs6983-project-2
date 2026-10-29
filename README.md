# LifeBoard

Your everyday plans and costs, alone or together.

**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang ([@SeraphimHuang](https://github.com/SeraphimHuang))

## Status

The app scaffold is in place ([#1](https://github.com/blouyakis/cs6983-project-2/issues/1)). Accounts, the database, and product features are not built yet. CI is [#2](https://github.com/blouyakis/cs6983-project-2/issues/2).

|                           |                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Production URL**        | Not deployed yet                                                                                                                        |
| **API docs (Swagger)**    | Served at `/api/docs` once deployed. Draft spec: [`docs/api/openapi.yaml`](./docs/api/openapi.yaml)                                     |
| **Issues and milestones** | [Issues](https://github.com/blouyakis/cs6983-project-2/issues) · [Milestones](https://github.com/blouyakis/cs6983-project-2/milestones) |
| **Project board**         | <!-- TODO: GitHub Projects board URL -->                                                                                                |
| **PRD**                   | [`docs/PRD.md`](./docs/PRD.md)                                                                                                          |
| **Demo video**            | Due with the final submission                                                                                                           |

---

## Overview

LifeBoard is a web app for planning and paying for everyday life, alone or with others. Every user has a **personal space** with their own list and spending. Users also create **groups** for any part of life, such as a dorm, a weekend picnic, or date nights. Members share one list and one ledger.

Checking off a list item records what it cost and who shares it. Costs that were never on the list can be added directly. Each group shows who owes whom, and a settle-up suggests the fewest payments that clear every balance. One overview shows personal spending, your share in each group, and what you owe or are owed.

### Who it's for

Roommates sharing a dorm or apartment, partners sharing a home, friends planning outings, co-parents splitting childcare costs, and anyone who wants to track their own plans and spending in the same place.

User stories are in [`docs/user-stories.md`](./docs/user-stories.md). Priorities are in the [PRD](./docs/PRD.md). Acceptance criteria for each piece of work are on its [GitHub issue](https://github.com/blouyakis/cs6983-project-2/issues).

## Features

Nothing below is built yet. The list follows the PRD's priorities.

**Must have**

- **Accounts:** register with email and password, log in with an expiring JWT, log out
- **Access control:** users only read or change data in groups they belong to
- **Groups and invitations:** create a group for any part of life and invite members by email
- **Lists:** add things to do or buy, and check them off with the actual cost and who shares it
- **Expenses:** log personal or group costs, split evenly or by custom amounts, and edit or delete until settled
- **Balances:** each member's net balance across unsettled expenses
- **Settle-up:** the fewest payments that clear every balance, marked paid and confirmed by the recipient
- **Overview:** personal total, share in each group, and net balance across groups

**Should have:** estimated costs on list items, direct payments between two members, an itemized bill per member, leaving a group with read-only history, a default split ratio, and filters by group, person, and date.

**Could have:** CSV export of a group's history and real-time updates.

### Out of scope

Recurring bills, a group activity log, group messaging, disputing charges, group admin roles, in-app payments, a map of past outings, and AI features. Reasons are in the [PRD](./docs/PRD.md).

## Tech stack

| Layer      | Choice                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| Frontend   | Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4            |
| Backend    | Next.js route handlers · Zod validation                                              |
| Database   | Supabase Postgres, used only as a database, through `@supabase/supabase-js` (no ORM) |
| Auth       | Our own JWT with `jose` · `bcryptjs` password hashing                                |
| Testing    | Vitest (unit and integration) · Playwright (E2E)                                     |
| API docs   | OpenAPI 3 · `swagger-ui-react`                                                       |
| CI/CD      | GitHub Actions · Vercel (preview per PR, production from `main`)                     |
| AI harness | Guided by [`AGENTS.md`](./AGENTS.md)                                                 |

## Architecture

<!-- TODO(#3): architecture diagram — required deliverable -->

```text
.
├── AGENTS.md              # shared rules for AI coding tools
├── DESIGN.md              # colors, screens, and UI components
├── README.md
├── LICENSE
├── .env.example
├── .nvmrc                 # Node 24
├── e2e/                   # Playwright
├── src/app/               # App Router. A placeholder home page only.
└── docs/
    ├── PRD.md
    ├── user-stories.md
    ├── architecture.md    # draft schema
    ├── api/openapi.yaml
    ├── design/            # mockup screenshots
    └── research/          # project proposal
```

Later issues add `src/components/`, `src/lib/`, and `supabase/migrations/`. The target layout is in [`AGENTS.md`](./AGENTS.md) Section 2.

### Database schema

<!-- TODO(#3): schema diagram — required deliverable -->

The draft is in [`docs/architecture.md`](./docs/architecture.md): `users`, `groups`, `group_members`, `list_items`, `expenses`, `expense_shares`, `payments`, and `settlements`. Issue [#3](https://github.com/blouyakis/cs6983-project-2/issues/3) finalizes it as SQL migrations.

## Getting started

These steps run the placeholder app. The database is not connected yet.

### Prerequisites

- Node.js 24 and npm. If you use nvm, `nvm use` reads `.nvmrc`.
- Docker, only after the database lands in [#3](https://github.com/blouyakis/cs6983-project-2/issues/3)

### Run locally

```bash
git clone git@github.com:blouyakis/cs6983-project-2.git
cd cs6983-project-2
nvm use                      # if you use nvm
npm install
npx playwright install chromium
cp .env.example .env.local   # the app does not read these values yet
npm run dev                  # http://localhost:3000
```

### Database

Not needed to run the app yet. After [#3](https://github.com/blouyakis/cs6983-project-2/issues/3):

```bash
npx supabase start
npx supabase db reset        # apply all migrations
```

### Environment variables

| Variable                    | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL                                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key                                      |
| `JWT_SECRET`                | Signing key for session tokens, at least 32 random characters |
| `NEXT_PUBLIC_APP_URL`       | Base URL of the app, e.g. `http://localhost:3000`             |

### Demo account

None yet.

## Testing

We follow **test-driven development**: the failing test is committed before the code, and that order is visible in the git history.

```bash
npm run lint          # ESLint, then Prettier check
npm run typecheck     # tsc --noEmit
npm test              # unit and integration (Vitest)
npm run test:coverage # coverage report
npm run test:e2e      # Playwright
```

Coverage goal: 80% of lines overall and 100% of `src/lib/domain`.

## CI/CD

Not set up yet; this is [#2](https://github.com/blouyakis/cs6983-project-2/issues/2). The plan is a GitHub Actions pipeline on every pull request: install, lint, typecheck, test, build, and a security scan. Vercel builds a preview for each PR and deploys `main` to production.

## Development workflow

- **Branches:** one per issue, from `main`, e.g. `feature/19-settle-up`
- **Commits:** Conventional Commits with the issue number, e.g. `feat(settle): suggest fewest payments (#19)`
- **Pull requests:** `Closes #<issue>` and how it was tested; one partner approval and green CI; merged with a merge commit
- **Sprints:** three sprints tracked as GitHub milestones (`Sprint 1 v.01`, `Sprint 2 v.02`, `Sprint 3 v.03`)
- **Standups and meetings:** logged in the [communication log](<!-- TODO: link to Google Sheet -->)
- **Planning and retrospectives:** will live in `docs/sprints/`

Full conventions are in [`AGENTS.md`](./AGENTS.md).

## API

Not implemented yet. The draft REST API is in [`docs/api/openapi.yaml`](./docs/api/openapi.yaml), and Swagger UI will be served at `/api/docs`.

Main resources: `/api/auth`, `/api/overview`, and `/api/groups/{groupId}` with `list-items`, `expenses`, `balances`, `bills/me`, `payments`, `settlements`, `invitations`, and `leave`.

## Project documentation

| Document                           | Location                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Rules for AI coding tools          | [`AGENTS.md`](./AGENTS.md)                                                 |
| PRD                                | [`docs/PRD.md`](./docs/PRD.md)                                             |
| User stories                       | [`docs/user-stories.md`](./docs/user-stories.md)                           |
| Project proposal                   | [`docs/research/project-proposal.md`](./docs/research/project-proposal.md) |
| Design and mockups                 | [`DESIGN.md`](./DESIGN.md) · [`docs/design/`](./docs/design/)              |
| Schema (draft)                     | [`docs/architecture.md`](./docs/architecture.md)                           |
| API spec (draft)                   | [`docs/api/openapi.yaml`](./docs/api/openapi.yaml)                         |
| Architecture and schema diagrams   | Not started (#3)                                                           |
| Sprint planning and retrospectives | Not started (`docs/sprints/`)                                              |
| Communication log                  | <!-- TODO -->                                                              |
| Contribution log                   | Not started (`docs/contributions.md`)                                      |
| HW3 before/after test              | <!-- TODO -->                                                              |

## Contributors

| Partner          | Primary areas                             |
| ---------------- | ----------------------------------------- |
| Barbara Louyakis | <!-- TODO: fill in as work is divided --> |
| Ziye Huang       | <!-- TODO -->                             |

Both partners commit, review, and maintain `AGENTS.md`.

## License

[MIT](./LICENSE)
