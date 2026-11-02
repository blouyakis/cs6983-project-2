# LifeBoard — P2 Completion Checklist

**CS 6983 Project 2** · Track progress toward shipping LifeBoard.

Tick each item off as it's completed. Every item applies to P2. Where the reference app, [vis-paper-planner](https://github.com/john-guerra/vis-paper-planner), shows a step, there is a **See it** link.

**This checklist tracks progress. It is not the rubric.** See "What P2 also requires" at the end, and the [P2 spec](https://github.com/john-guerra/ai-coding-class/blob/main/course/projects/project2-full-stack.md).

---

## Steps 0–1: Idea, research, PRD

- [x] Chose LifeBoard: a multi-user expense-splitting and bill-tracking app for shared households
- [x] *Optional for P2:* Mom Test conversations in `docs/research/`
- [x] `docs/PRD.md`: problem (shared bills complexity), personas (roommates, couples, friend groups), user stories with acceptance criteria
- [x] Stack: Next.js 16 (App Router) + Tailwind CSS 4, Next.js API routes, Supabase PostgreSQL, JWT auth

**See it:** [PRD](docs/PRD.md) · [User stories](docs/user-stories.md)

## Step 2: DESIGN.md

- [x] Mockup in `docs/design/`: interactive high-fidelity design with all screens
- [x] `DESIGN.md` at the repo root: tokens (colors, type, spacing), component specs, and UI rules
- [x] `npx @google/design.md lint DESIGN.md` passes
- [x] Tailwind theme generated from it
- [x] `AGENTS.md` (Section 5) says "UI work follows `DESIGN.md`"

**See it:** [DESIGN.md](DESIGN.md) · [Mockups](docs/design/)

## Step 3: Rules and memory files

- [x] `AGENTS.md` at the repo root: covers stack, commands, conventions, testing strategy, security rules, domain rules, and Git workflow
- [x] Includes exact npm commands, Node.js version, and how to run Supabase locally
- [x] Records workflow: PO and SM rotate each sprint, one branch per issue, partner review before merge
- [x] Changed through PRs with a changelog; revisited at retros
- [x] `CLAUDE.md` contains `@AGENTS.md` so Claude Code loads the shared rules

**See it:** [AGENTS.md](AGENTS.md) · [Changelog in AGENTS.md](AGENTS.md#changelog)

## Step 4: Backlog and board

- [x] User stories turned into GitHub issues with templates (story, acceptance criteria, estimate)
- [x] One milestone per sprint, with labels `feature`, `bug`, `chore`
- [x] Board columns: Backlog · Sprint Todo · In Progress · In Review · Done
- [x] Sprint planning: `docs/sprints/sprint-1/planning.md`, `sprint-2/planning.md`, etc. (goal, issues, estimates, PO and SM)
- [x] PR template with `Closes #N`, test steps, and partner-review checkbox
- [x] Workflow: branch per issue → implement in code/agent → self-review → PR → partner review → merge → Done

**See it:** [Issues board](https://github.com/blouyakis/cs6983-project-2/issues) · [Sprint docs](docs/sprints/)

## Step 5: CI

- [x] `.github/workflows/ci.yml` runs on every PR
- [x] Stages: lint + format check → unit + integration tests → build → E2E (Playwright)
- [x] Security scanning (npm audit and dependency checks)
- [x] Branch protection: PRs merge only when CI is green
- [x] Pre-commit hook with Husky + lint-staged runs lint and format locally
- [x] CI never uses production secrets; tests run against local Supabase or test database

**See it:** [CI workflow](.github/workflows/ci.yml) · [Husky config](.husky/)

## Step 6: Build features test-first

- [x] Thin vertical slice: one page → one API route → one or more database tables
- [x] Commit the failing test first (red), then the code (green), then refactor — separate commits
- [x] Schema changes in SQL migrations (`npx supabase migration new <name>`), not dashboard clicks
- [x] Seed script in `supabase/seed.sql` so both partners and CI get the same test data
- [x] Tests cover the golden path and error cases: empty/bad input, access control, database constraints
- [x] API routes documented in `docs/api/openapi.yaml`
- [x] Pages tested in browser: check visual correctness against mockup, keyboard navigation, responsive design

**See it:** [Tests](supabase/tests/) · [API docs](docs/api/openapi.yaml) · [Architecture](docs/architecture.md)

## Step 7: Deploy

- [x] Production deploys from `main` via Vercel; every PR gets a preview URL
- [x] Env vars configured per environment on Vercel; `.env.example` lists names only, never values
- [x] Database migrations documented and tested before prod deployment
- [x] Preview deploys use a test database (never production data)
- [x] One health-check endpoint proves the app *and* database are up
- [x] `README.md` includes live URL, local setup steps, and how to run database migrations

Deploy early—on Day 1 if possible—so deploying is never the risky last step.

**See it:** [README.md](README.md) · [Deploy docs](docs/deploy.md)

## Pitfalls to avoid

- **CLAUDE.md doesn't reference AGENTS.md.** Claude reads `AGENTS.md` only when there is no `CLAUDE.md`. If you have both, `CLAUDE.md` must say `@AGENTS.md`. ([Claude Code memory docs](https://code.claude.com/docs/en/memory))
- **Rules drift in multiple tool folders.** One `AGENTS.md` at the root, loaded by `CLAUDE.md`. Don't copy it.
- **Memory files that keep growing.** Longer files use more context and get followed less closely. Link to `docs/` instead.
- **Nested AGENTS.md files.** Copilot ignores them by default. Keep rules at the root.
- **Copying DESIGN.md from a gallery.** Your app will look generic. Start with your mockups and colors.
- **Committing .env files.** Deleting it later isn't enough; rotate the keys in Vercel and `.env.local`.
- **Forgetting to test money calculations.** Rounding errors, off-by-one cents, and split bugs hide in integration tests. Test against a real database.
- **Settlemnt logic in the browser.** Balances and payment suggestions must come from the server. Test them there.

## What P2 requires for LifeBoard

| Area | Required |
| --- | --- |
| Features | **Auth:** JWT via `session` cookie · **Core flows:** sign up, groups, lists, expenses, settlements · **3+ features:** expense tracking, settle-up, payment history · **Real-time or state:** balance updates, settlement suggestions · **Public API:** OpenAPI-documented endpoints · **Money:** exact cent calculations, no rounding drift |
| Testing | Vitest unit + integration (80% lines, 100% of `lib/domain`) · Playwright E2E · Failing tests committed first · Database tests in `supabase/tests/` against real Postgres |
| CI/CD | Multi-stage: lint → test → build → E2E · Preview deploys on every PR · Security scan (npm audit) · Automated prod deploy from `main` |
| Process | 2+ sprints, each a GitHub milestone with 5+ issues · Sprint planning + retro docs · 3+ standups per partner per sprint · 5+ partner PR reviews each · Story point estimates |
| Docs | `README.md` with live URL and setup · `docs/PRD.md` · `docs/architecture.md` with DB schema diagram · `docs/api/openapi.yaml` with all endpoints · 10-minute demo video · Contribution log · 300-word reflection per partner |
