# Project 2: LifeBoard

**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang ([@SeraphimHuang](https://github.com/SeraphimHuang))

LifeBoard is a web app for planning and paying for everyday life, alone or with others: shared lists, expenses with even or custom splits, balances, and a settle-up that suggests the fewest payments. The [README](https://github.com/blouyakis/cs6983-project-2#readme) has the full overview.

## 1. GitHub repository

| | Link |
|---|---|
| Repository | <https://github.com/blouyakis/cs6983-project-2> |
| Commit history from both partners | [Commits on `main`](https://github.com/blouyakis/cs6983-project-2/commits/main) · [Contributors graph](https://github.com/blouyakis/cs6983-project-2/graphs/contributors) |
| Pull requests and reviews | [Merged pull requests](https://github.com/blouyakis/cs6983-project-2/pulls?q=is%3Apr+is%3Amerged): 73, all but 3 approved by the other partner ([README Contributors](https://github.com/blouyakis/cs6983-project-2#contributors)) |
| Issues, board and milestones | [Issues](https://github.com/blouyakis/cs6983-project-2/issues) · [Project board](https://github.com/users/blouyakis/projects/3) · [Milestones](https://github.com/blouyakis/cs6983-project-2/milestones) (3 sprints) |

## 2. Deployed app

| | Link |
|---|---|
| Production URL | <https://cs6983-project-2.vercel.app>, deployed by Vercel from `main` |
| Health check | [`/api/health`](https://cs6983-project-2.vercel.app/api/health) |
| API docs (Swagger UI) | [`/api/docs`](https://cs6983-project-2.vercel.app/api/docs) |

## 3. Documentation package

| Requirement | Where |
|---|---|
| Comprehensive README | [`README.md`](https://github.com/blouyakis/cs6983-project-2#readme) |
| API documentation (OpenAPI/Swagger) | Spec: [`docs/api/openapi.yaml`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/api/openapi.yaml) (35 operations, checked by Redocly in `npm run lint`) · Swagger UI: [`/api/docs`](https://cs6983-project-2.vercel.app/api/docs) |
| Architecture diagram | [`docs/architecture.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md): [system overview](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#1-system-overview), [layers](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#2-layers), [a request end to end](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#3-a-request-end-to-end) |
| Database schema diagram | [ER diagram and tables](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#5-database-schema) · [SQL migrations](https://github.com/blouyakis/cs6983-project-2/tree/main/supabase/migrations) |
| Setup/deployment guide | README [Getting started](https://github.com/blouyakis/cs6983-project-2#getting-started) and [Deploying](https://github.com/blouyakis/cs6983-project-2#deploying) · [Environments and hosted migrations](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#7-environments-and-configuration) |
| Sprint retrospectives | [Sprint 1](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-1/retrospective.md) · [Sprint 2](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-2/retrospective.md) · [Sprint 3](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-3/retrospective.md) · planning notes for [Sprint 2](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-2/planning.md) and [Sprint 3](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-3/planning.md) |
| 10-minute demo video | See [Section 4](#4-demo-video) |
| Partner contribution log | [README Contributors](https://github.com/blouyakis/cs6983-project-2#contributors) · standups and meetings in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?usp=sharing&ouid=108877617046558983136&rtpof=true&sd=true) |
| Individual reflections | See [Section 5](#5-individual-reflections) |

Other project documents: [PRD](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/PRD.md) · [User stories](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/user-stories.md) · [`DESIGN.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/DESIGN.md) and [mockups](https://github.com/blouyakis/cs6983-project-2/tree/main/docs/design).

## 4. Demo video

[Watch on Google Drive](https://drive.google.com/file/d/1494diXEHRoWIOhft6suQb5_lidpIGMdy/view?usp=sharing). It walks through the user flows in [`AGENTS.md` Section 5](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md#5-prd-and-design-references).

## 5. Individual reflections

Each partner submits their reflection separately. Copies are in the repository: [Barbara](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/barbara.md) · [Ziye](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/ziye.md).

## Rubric evidence

| Category | Where to look |
|---|---|
| Functionality (45) | README [Features](https://github.com/blouyakis/cs6983-project-2#features): every Must Have and Should Have in the PRD is built · [production app](https://cs6983-project-2.vercel.app) |
| Technical Excellence (60) | Layers in [`docs/architecture.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#2-layers) · TDD: failing `test(...)` commits come before each `feat(...)` commit ([`AGENTS.md` Section 4](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md#4-testing-strategy)) · unit, database and E2E test counts in the [Sprint 3 retrospective](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-3/retrospective.md#2-the-sprint-in-numbers) · security rules in [`AGENTS.md` Section 8](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md#8-dos-and-donts) and [architecture Section 4](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md#4-authentication-and-access-control) |
| AI Mastery (30) | Shared rules file [`AGENTS.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md) (loaded through [`CLAUDE.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/CLAUDE.md)) and its [Changelog](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md#changelog) · before/after test of the rules on issue #4: [`docs/sprints/issue-4-comparison.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/issue-4-comparison.md) · [HW3 submission](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/hw3/hw3-submission.md) |
| CI/CD & DevOps (30) | [`ci.yml`](https://github.com/blouyakis/cs6983-project-2/blob/main/.github/workflows/ci.yml): install, lint, typecheck, test, db-test, build, e2e and `npm audit`, all required on every pull request · Vercel preview per pull request and production from `main` (README [CI/CD](https://github.com/blouyakis/cs6983-project-2#cicd)) |
| Agile Process & Pair Workflow (20) | Three sprints with planning notes and retrospectives (Section 3) · standups in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?usp=sharing&ouid=108877617046558983136&rtpof=true&sd=true) · partner reviews: Barbara 36, Ziye 34 ([Sprint 3 retrospective](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-3/retrospective.md#2-the-sprint-in-numbers)) |
| Documentation (15) | Section 3 above |
