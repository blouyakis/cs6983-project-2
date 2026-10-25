Readme · MD
# <!-- TODO: Project name --> — Shared & Personal Expense Manager
 
<!-- TODO: One-line tagline, e.g. "Track what you spend, what you share, and what your plans will cost — in one place." -->
 
**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang: <!-- TODO: Ziye's GitHub handle -->
 
| | |
|---|---|
| **Production URL** | <!-- TODO: deployed app URL --> |
| **API docs (Swagger)** | <!-- TODO: production URL -->/api/docs |
| **Project board** | <!-- TODO: GitHub Projects board URL --> |
| **PRD** | <!-- TODO: link to PRD Google Doc --> |
| **Demo video** | <!-- TODO: link, due with final submission --> |
 
---
 
## Overview
 
<!-- TODO: Project name --> is a web app for people who split costs with others but still want to see their own spending in one view. Users create **groups** (a dorm, a household, a co-parenting arrangement, a weekend trip) and log expenses that are either personal or shared with a group. Shared expenses can be split evenly, by custom amounts, or by a group's default ratio. Groups also carry a **to-do list with estimated costs** and a **shared shopping list**, so planned spending shows up before it happens and checked-off purchases become expenses automatically.
 
### Who it's for
 
| Persona | Need |
|---|---|
| Dorm roommate | Track shared and personal expenses in one place; see who owes whom |
| Frequent traveler | Plan outings as to-dos with estimated costs and compare to actuals |
| Co-parent | Split childcare costs by a fixed ratio and keep a settlement history |
 
See the [PRD](<!-- TODO: PRD link -->) for full user stories and acceptance criteria.
 
## Features
 
- **Authentication** — email/password registration, JWT login, protected routes, group-scoped data access
- **Groups** — create, name, and invite members; set a default split ratio for two-person groups
- **Expenses** — personal or group; even / custom / default-ratio splits; edit and delete with permission checks
- **Balances & settlements** — per-group "you owe / you are owed"; record payments and watch balances update
- **Dashboard** — monthly personal total, share of each group, net balance
- **To-do list with costs** — estimated cost per item, running total per group, estimated vs. actual on completion
- **Shared shopping list** — checking off an item records the purchase as a group expense
- **Expense history** — filter by group, person, and date range; CSV export
- **Public REST API** — documented with OpenAPI 3 / Swagger UI
### Out of scope (parked)
Password reset, receipt scanning, AI price estimation, outings map. See the [project board](<!-- TODO -->) for any that get picked up.
 
## Tech stack
 
| Layer | Choice |
|---|---|
| Frontend | Next.js <!-- TODO: version --> (App Router) · React · TypeScript · Tailwind CSS |
| Backend | Next.js API routes <!-- TODO: confirm vs. separate Express server --> |
| Database | <!-- TODO: Supabase (PostgreSQL) via Prisma, or MongoDB Atlas via Mongoose — pending professor's answer --> |
| Auth | JWT (bcrypt password hashing) |
| Testing | Vitest (unit/integration) · Playwright (E2E) |
| CI/CD | GitHub Actions · Vercel deploy previews <!-- TODO: confirm host --> |
| AI harness | <!-- TODO: Cursor / Claude Code / Antigravity --> guided by [`AGENTS.md`](./AGENTS.md) |
 
## Architecture
 
<!-- TODO: architecture diagram (image or Mermaid) — required deliverable -->
 
```
<!-- TODO: replace with real folder structure once scaffolded -->
/
├── app/                # Next.js App Router pages and layouts
│   ├── (auth)/         # login, register
│   ├── dashboard/
│   ├── groups/[id]/
│   └── api/            # REST API route handlers
├── components/         # Reusable UI components
├── lib/                # Business logic (split calculations, balances, auth helpers)
├── prisma/ or models/  # Schema and migrations / Mongoose models
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/               # Diagrams, retros, API spec
├── AGENTS.md           # Rules file for AI-assisted development
└── README.md
```
 
### Database schema
 
<!-- TODO: schema diagram (image or Mermaid ERD) — required deliverable -->
 
Entities: `User`, `Group`, `GroupMember` (holds `defaultSplitRatio`), `Expense`, `ExpenseSplit`, `TodoItem`, `ShoppingItem`, `Settlement`. See [`docs/schema.md`](./docs/schema.md). <!-- TODO: create -->
 
## Getting started
 
### Prerequisites
- Node.js <!-- TODO: version --> and npm
- <!-- TODO: Supabase project or MongoDB Atlas cluster --> (free tier is sufficient)
### Run locally
```bash
git clone <!-- TODO: repo URL -->
cd <!-- TODO: repo folder -->
npm install
cp .env.example .env        # then fill in the values below
npm run db:migrate          # TODO: confirm script name
npm run db:seed             # creates a demo user and sample data
npm run dev                 # http://localhost:3000
```
 
### Environment variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Connection string |
| `JWT_SECRET` | Signing key for tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| <!-- TODO: others --> | |
 
### Demo account
<!-- TODO: seeded demo credentials, if you choose to publish them -->
 
## Testing
 
We follow **TDD (red → green → refactor)**: failing tests are committed before the implementation for every feature, and that order is visible in the git history.
 
```bash
npm test              # unit + integration (Vitest)
npm run test:e2e      # Playwright, against local dev server
npm run test:coverage # TODO: confirm script and coverage target
```
 
Coverage goal: <!-- TODO: e.g. 80% on lib/ -->.
 
## CI/CD
 
Every pull request runs a multi-stage GitHub Actions pipeline: **install → lint → unit/integration tests → build → security scan**, plus a deploy preview. Merges to `main` deploy to production automatically.
 
Workflow files: [`.github/workflows/`](./.github/workflows/) <!-- TODO: confirm -->
 
## Development workflow
 
- **Branch per issue:** `feature/<issue#>-short-description`, `chore/…`, `docs/…`, `bug/…`
- **Commits:** Conventional Commits, referencing the issue — `feat(expenses): add custom split (#8)`
- **PRs:** link the issue (`Closes #8`), CI must pass, partner review required before merge
- **Sprints:** three one-week sprints tracked as GitHub milestones (`Sprint 1 v.01`, `Sprint 2 v.02`, `Sprint 3 v.03`); 5+ issues each with acceptance-criteria checklists, labels, and estimates
- **Standups and meetings:** logged in the [communication log](<!-- TODO: link to Google Sheet -->)
- **Retrospectives:** [`docs/retros/`](./docs/retros/) <!-- TODO: create -->
Full conventions, do's and don'ts, and design references are in [`AGENTS.md`](./AGENTS.md).
 
## API
 
The REST API is documented with OpenAPI 3. Swagger UI is served at `/api/docs` and the spec lives at [`docs/openapi.yaml`](./docs/openapi.yaml). <!-- TODO: create -->
 
Main resources: `/api/auth`, `/api/groups`, `/api/expenses`, `/api/groups/:id/balances`, `/api/groups/:id/settlements`, `/api/groups/:id/todos`, `/api/groups/:id/shopping`.
 
## Project documentation
 
| Document | Location |
|---|---|
| PRD and user stories | <!-- TODO --> |
| Mockups | <!-- TODO --> |
| Architecture diagram | <!-- TODO --> |
| Schema diagram | <!-- TODO --> |
| Sprint retrospectives | `docs/retros/` |
| Communication log | <!-- TODO --> |
| Contribution log | [`docs/contributions.md`](./docs/contributions.md) <!-- TODO: create --> |
| HW3 before/after test | <!-- TODO --> |
 
## Contributors
 
| Partner | Primary areas |
|---|---|
| Barbara Louyakis | <!-- TODO: fill in as work is divided --> |
| Ziye Huang | <!-- TODO --> |
 
Both partners commit, review, and maintain `AGENTS.md`. See the contribution log for a detailed breakdown.
 
## License
 
<!-- TODO: e.g. MIT, or "Academic project — not licensed for reuse" -->

