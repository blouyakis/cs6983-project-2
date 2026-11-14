# Project 2: LifeBoard

**CS6983 AI Coding · Project 2 (Full-Stack Application) · Fall 2026**
**Team:** Barbara Louyakis ([@blouyakis](https://github.com/blouyakis)) · Ziye Huang ([@SeraphimHuang](https://github.com/SeraphimHuang))

## About LifeBoard

LifeBoard is a web app for planning and paying for everyday life, alone or with others.

### The problem

Everyday plans cost money: restocking the kitchen, paying the internet bill, a weekend picnic, a date night. Many of them are shared with roommates, a partner, friends or a co-parent. Today the pieces live in different places. What to buy sits in a notes app or a group chat, who paid for what is scattered across receipts and memory, and who owes whom is worked out by hand in a spreadsheet. So items get bought twice or not at all, nobody knows what a plan really cost, and settling up takes more transfers than it needs to. Money is also awkward to bring up, so small amounts turn into friction. List apps track plans but not money, and expense splitters track money but not the plans behind it.

### What LifeBoard does

LifeBoard puts the plan and the money in one place. Users organize their life into **groups**, such as "Dorm 4B", "Saturday picnic" or "Date nights", and every user also has a private **personal space**. The core loop is:

**add an item to the shared shopping and to-do list → check it off with what it actually cost → the cost is split among the members who share it → everyone sees who owes whom → settle up with the fewest payments.**

- **Shared shopping and to-do lists:** every member sees the same list, who added each item and an optional estimated cost, with a running total. Checking an item off records the actual cost and who shares it (everyone by default) and turns it into a group expense paid by the member who bought it. The item then shows who completed it, the cost and when, so nothing gets bought twice.
- **Expenses and splits:** costs that were never on the list, like the electricity bill, can be added directly. Each cost is split evenly or by custom amounts, or by the group's default ratio such as 60/40. Money is stored in integer cents, and leftover cents go to the payer, so shares always add up exactly.
- **Balances and settle-up:** each group shows every member's balance in words ("you owe" or "you are owed"). Any member can start a settle-up, and the app suggests the **fewest possible payments** that clear every balance, found by an exact search rather than a greedy guess. Payers mark payments paid, recipients confirm them, and the period closes and locks its expenses. Members can also pay each other directly between settle-ups. The app records payments made elsewhere; it never moves money.
- **Bills and history:** each member sees an itemized bill of only the costs they share and what they owe each member, including past periods, and can filter the expense history by group, person and date.
- **Overview:** one page shows personal spending, your share in each group and your net balance across all groups.
- **Leaving a group:** a member with a zero balance can leave and keeps read-only access to the history up to the day they left.

It is for roommates sharing a dorm or apartment, partners sharing a home, friends planning outings, co-parents splitting childcare costs, and anyone who wants their own plans and spending in the same place. Every Must Have and Should Have in the [PRD](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/PRD.md) is built; the [README Features](https://github.com/blouyakis/cs6983-project-2#features) section lists each one with its issue.

### How it is built

One Next.js 16 (App Router) app on Vercel serves both the pages and a REST API, with React 19, TypeScript strict and Tailwind CSS 4. Data lives in Supabase Postgres, reached only from the server, with Row Level Security on every table. Login uses our own JWT in an `httpOnly` cookie and bcrypt password hashing. Every request goes route handler → service → domain and database, with Zod validation at the boundary and one access check, `requireGroupAccess`, for every group. The money rules are pure functions in `src/lib/domain` with 100% test coverage. Details are in [`docs/architecture.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/architecture.md).

### At a glance

Counted on 2026-11-14.

| Measure | Count |
|---|---|
| Features | 14 of 14 planned: all 8 Must Haves and all 6 Should Haves in the [PRD](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/PRD.md), from 8 [user stories](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/user-stories.md) |
| REST API | 35 operations on 27 paths, all implemented and documented in [`openapi.yaml`](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/api/openapi.yaml) |
| Database | 8 tables, 28 SQL [migrations](https://github.com/blouyakis/cs6983-project-2/tree/main/supabase/migrations), Row Level Security on every table |
| Sprints | 3, each a [milestone](https://github.com/blouyakis/cs6983-project-2/milestones) with a retrospective |
| Issues | 69 [issues](https://github.com/blouyakis/cs6983-project-2/issues?q=is%3Aissue), all closed: 9 in Sprint 1, 22 in Sprint 2, 38 in Sprint 3 |
| Pull requests | 78 [merged](https://github.com/blouyakis/cs6983-project-2/pulls?q=is%3Apr+is%3Amerged) (Barbara 37, Ziye 41), 75 of them approved by the other partner |
| Partner PR reviews | Barbara reviewed 38 of Ziye's pull requests, Ziye reviewed 37 of Barbara's |
| Tests | 1,674 unit and integration tests (96.6% line coverage, 100% of `src/lib/domain`), 337 database tests, 81 Playwright E2E tests including WCAG 2.1 AA checks ([Sprint 3 retrospective](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/sprints/sprint-3/retrospective.md#2-the-sprint-in-numbers)) |
| CI | 8 required checks on every pull request: install, lint, typecheck, test, db-test, build, e2e, audit; Vercel preview per pull request, production from `main` |
| Communication log | 68 entries in the [communication log](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?usp=sharing&ouid=108877617046558983136&rtpof=true&sd=true), from 2026-10-22 to 2026-11-13: 28 in Sprint 1, 18 in Sprint 2, 22 in Sprint 3. 58 are async standup updates, 4 sprint planning sessions, 1 live meeting and 5 other discussions, and each records the topics, decisions and action items |

## 1. GitHub repository

| | Link |
|---|---|
| Repository | <https://github.com/blouyakis/cs6983-project-2> |
| Commit history from both partners | [Commits on `main`](https://github.com/blouyakis/cs6983-project-2/commits/main) |
| Pull requests and reviews | [Merged pull requests](https://github.com/blouyakis/cs6983-project-2/pulls?q=is%3Apr+is%3Amerged): 78, 75 of them approved by the other partner · [README Contributors](https://github.com/blouyakis/cs6983-project-2#contributors) |
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
| 10-minute demo video | [Watch on Google Drive](https://drive.google.com/file/d/1494diXEHRoWIOhft6suQb5_lidpIGMdy/view?usp=sharing) |
| Partner contribution log | [README Contributors](https://github.com/blouyakis/cs6983-project-2#contributors): who did what, with the issues each partner built |
| Communication log (standups and meetings) | [Google Sheet](https://docs.google.com/spreadsheets/d/1xbZLsDWi8kCrbk7bfrR18Wg7M5aKSlbO/edit?usp=sharing&ouid=108877617046558983136&rtpof=true&sd=true): 68 entries, each with its date, type, attendees, topics, decisions and action items |
| Individual reflections | [Barbara](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/barbara.md) · [Ziye](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/ziye.md) |

Other project documents: [PRD](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/PRD.md) · [User stories](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/user-stories.md) · [`DESIGN.md`](https://github.com/blouyakis/cs6983-project-2/blob/main/DESIGN.md) and [mockups](https://github.com/blouyakis/cs6983-project-2/tree/main/docs/design).

## 4. Demo video

[Watch on Google Drive](https://drive.google.com/file/d/1494diXEHRoWIOhft6suQb5_lidpIGMdy/view?usp=sharing). It walks through the user flows in [`AGENTS.md` Section 5](https://github.com/blouyakis/cs6983-project-2/blob/main/AGENTS.md#5-prd-and-design-references).

## 5. Individual reflections

Each partner submits their reflection separately. Copies are in the repository: [Barbara](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/barbara.md) · [Ziye](https://github.com/blouyakis/cs6983-project-2/blob/main/docs/reflections/ziye.md).
