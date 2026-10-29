# Product Requirements Document: LifeBoard

CS6983 AI Coding, Project 2. Barbara Louyakis and Ziye Huang.

## 1. Problem

Everyday life is full of small plans that cost money: restocking the kitchen, paying the internet bill, a weekend picnic, a date night, a home project. Many of these plans are shared with other people, such as roommates, a partner, friends or a co-parent, and some are just our own.

Today, the pieces of these plans live in different places. What needs to be done or bought sits in a notes app or a group chat. Who bought what, and for how much, is scattered across receipts, screenshots and memory. Who owes whom is worked out in a spreadsheet or by hand. This causes recurring problems:

- **Shared plans are uncoordinated.** No one knows what has already been done or bought, so items get bought twice or not at all.
- **Plans and costs are disconnected.** People can’t easily see what a plan will cost before they commit, or what it actually cost afterward.
- **Working out who owes whom is tedious.** After many purchases paid by different people, calculating fair payments by hand is slow and error-prone, and settling up often takes more transfers than it needs to.
- **Personal and shared spending are split apart.** It is hard to see the full picture of what you have spent and what you owe.

Money is also an awkward subject between people who live or spend time together. When the numbers are unclear, people put off asking, and small amounts turn into friction. Existing tools cover only part of the problem: to-do and list apps track plans but not money, and expense splitters track money but not the plans that lead to it.

## 2. Target Users

Anyone who plans and pays for everyday life, alone or with other people. This includes roommates sharing a dorm or apartment, partners sharing a home, friends planning outings, co-parents who split childcare costs, and people who want to plan and track their own spending in the same place.

Typical characteristics:

- Share recurring plans and costs with the same small groups of people
- Currently keep plans in notes apps or group chats, and money in spreadsheets or their heads
- Want to know what a plan will cost and who owes what, without doing the math
- Want personal and shared spending in one place
- Find it awkward to ask others for money

## 3. Proposed Solution

LifeBoard is a web app for planning and paying for everyday life, alone or with others. Users organize their life into groups, such as a household, a weekend outing or date nights, and each group brings together what needs to be done or bought, what it costs, and who owes whom. Its core loop is simple:

record a cost (by checking off a list item or adding it directly) → split it → see who owes whom → settle up.

**Overview.** Users can see where they stand across every part of life: their personal spending total, their share in each group, and a net “you owe / you are owed” balance across all groups. They can filter their expenses by group, by person and by date range.

**Groups.** A group can represent any part of life, and users name it however they like (e.g., “Dorm 4B”, “Saturday picnic”, “Date nights”). A user creates a group and invites members by email. All members are equal, and any member can invite others.

**Personal space.** Every user also has their own personal space for plans and spending that involve no one else. It has its own list, and checking off an item records the cost as a personal expense. Personal expenses can also be logged directly. Nothing in the personal space is split or visible to anyone else.

**Lists.** Each group has a shared list of things to do or buy, such as groceries, the internet bill or snacks for a picnic. Every member sees the same list, who added each item, and whether it is still open or done; for done items, they also see who completed it, the cost, and when. Items can carry an optional estimated cost, and the group shows a running total of estimated costs for open items. When a member checks an item off, they enter the actual cost (if any) and choose who shares it (everyone, by default), and it becomes a group expense with them as the payer. The group can then compare estimated and actual totals.

**Expenses and splits.** Costs that were never on a list, like this month’s electricity bill or a roommate dinner, can be added directly. An expense has an amount, description, date, payer, and the members who share it. Group expenses are split evenly or by custom amounts, and custom amounts must add up to the total. A group can set a default split ratio (e.g., 60/40) that applies to new expenses and can be overridden on any single expense. Amounts are stored in cents; when an even split does not divide exactly, the leftover cents are assigned to the payer’s share. The payer can edit or delete an expense until it is settled; settled expenses are locked so closed periods stay accurate.

**Balances and settling up.** Each group shows every member’s net balance across all unsettled expenses. Any member can start a settle-up at any time. The app then suggests the fewest possible payments that bring every balance to zero (e.g., “Alex pays Sam $23.50”). Members mark their payments as paid and recipients confirm them; once every payment is confirmed, the period closes, balances reset to zero, and the settled expenses move to history. Between settle-ups, a member can also pay another member directly, one payment at a time; once the recipient confirms, both balances and the suggested payments update. The app records payments people make elsewhere; it does not move money.

**Bills.** Every member can see all of a group’s expenses, including ones they are not part of, so the group’s records are fully transparent. Each member can also view an itemized bill for a group that includes only the expenses they share: who paid, the total, their share, and their running total owed to each member. Bills from previous settle-up periods remain available, and a group’s history can be viewed for any date range.

**Leaving a group.** A member can leave a group once their balance is settled, through a group settle-up or direct payments. After leaving, they keep read-only access to the group’s history up to the date they left, but cannot add or edit anything or see anything added later. Their past expenses stay in the group’s history for the remaining members. A group continues even when only one member remains, and that member can keep using it or invite new members. When the last member leaves, the group is archived: no one can add anything, and every former member keeps read-only access to its history.

**Accounts and privacy.** Users register with an email and a password (stored hashed) and log in with a JWT that expires. Users can only read or modify data in groups they belong to; former members can only read history up to the date they left.

**Public API.** All features are available through a REST API documented with OpenAPI 3, with interactive documentation at `/api/docs`.

Design principles:

- **Work the way users already do.** Users can plan on a list first or record a cost directly after it happens, whichever fits the situation.
- **Everyone sees the same numbers.** Lists, balances and bills are shared, so there is nothing to argue about.
- **Do the math for people.** Splits, balances and payment suggestions are calculated, never worked out by hand.
- **Settle in as few transfers as possible.** Paying each other back should take the smallest number of payments.
- **Settled records are kept.** Settled expenses and the records of members who left stay in history.
- **Users stay in control.** The app suggests; people confirm and can edit everything.

## 4. Prioritization (MoSCoW)

Story numbers below are [US-1 through US-8](user-stories.md).

### Must Have

| Story | Feature                       | Description                                                                                                                                                               | Justification                                                                                  |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 4     | Accounts and authentication   | Users register with email and password, log in with an expiring JWT, and log out. Protected pages redirect to login, and API requests without a valid token return 401.   | Every other feature depends on knowing who the user is.                                        |
| 4     | Group-based access control    | Users can only read or modify lists, expenses and balances in groups they belong to.                                                                                      | Financial data is private; this is a basic security requirement.                               |
| 1, 2  | Groups and invitations        | Users create a group for any part of life, name it, and invite members by email.                                                                                          | Lists, expenses and balances all live inside groups.                                           |
| 2, 5  | Lists                         | Members add things to do or buy, see who added them and their status, and check them off with an actual cost and the members who share it, which creates a group expense. | Connects plans to costs; the main thing that sets the app apart from a plain expense splitter. |
| 1, 5  | Expense logging and splitting | Users log personal or group expenses directly and split group expenses evenly or by custom amounts. The payer can edit or delete an expense until it is settled.          | The core record that every balance and bill is calculated from.                                |
| 6     | Balances                      | Each group shows every member’s net balance across unsettled expenses.                                                                                                    | Answers the core question of who owes what.                                                    |
| 6     | Group settle-up               | The app suggests the fewest payments that clear all balances; members mark payments as paid, recipients confirm, and the period closes.                                   | Completes the core loop by turning balances into action.                                       |
| 1     | Overview                      | Users see their personal total, their share in each group, and a net “you owe / you are owed” balance across all groups.                                                  | Users need one place to see where they stand across every part of life.                        |

### Should Have

| Story | Feature             | Description                                                                                                                              | Justification                                                                                                                  |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2     | Estimated costs     | List items carry an optional estimated cost; the group shows a running total for open items and compares estimated and actual totals.    | Lets users see what a plan will cost before they commit, though lists work with actual costs alone.                            |
| 6     | Direct payments     | A member pays another member before a group settle-up; once confirmed, balances and suggested payments update.                           | Lets one person settle without the whole group and is needed for leaving a group, though the group settle-up works without it. |
| 7     | Itemized bill       | Each member sees every expense they are included in, who paid, their share, and their total owed to each member, including past periods. | Lets members check charges before paying, though balances alone already show the totals.                                       |
| 8     | Leaving a group     | A member can leave once settled and keeps read-only access to history up to the date they left.                                          | Handles common situations like moving out, though groups work without it.                                                      |
| 3     | Default split ratio | A group sets a ratio (e.g., 60/40) that applies to new expenses and can be overridden on any single expense.                             | Saves time for groups that always split unevenly, though custom splits already cover the need.                                 |
| 1, 3  | Filtering           | Users filter expenses by group, by person and by date range.                                                                             | Helps users find expenses as history grows, though a simple list works when there are only a few.                              |

### Could Have

| Story | Feature           | Description                                                                      | Justification                                                                                                                                |
| ----- | ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | History export    | Users export a group’s expenses and settlements for a date range (e.g., as CSV). | Useful as an outside record, for example between co-parents, though history can already be viewed in the app.                                |
| 5     | Real-time updates | Lists and balances update live for all members without refreshing the page.      | Helps when several members use a list at the same time, such as two roommates shopping, though changes already appear when the page reloads. |

### Won’t Have (This Time)

| Item | Feature             | Description                                                                                        | Justification                                                                                                                 |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| —    | Recurring bills     | Monthly bills like utilities are created automatically.                                            | Bills can be added directly each month; automation adds scheduling logic for little gain.                                     |
| —    | Group activity log  | Each group keeps an automatic, time-ordered record of every change, including edits and deletions. | Adds record-keeping to every action; members already review their bills before settling up, when any wrong amount would show. |
| —    | Group messaging     | Members send their own messages or comments within a group.                                        | Adds a separate feature to build, and members can talk outside the app for now.                                               |
| —    | Disputing charges   | Members flag a charge, add a comment, and notify the payer, who can then edit it.                  | Requires comments and notifications; members can discuss a charge outside the app for now.                                    |
| —    | Group admin roles   | One member manages invitations and removes members.                                                | Group members are equals, and admin roles add edge cases (such as the admin leaving) without much value.                      |
| —    | In-app payments     | Members send money through Venmo, PayPal or a bank from inside the app.                            | Payment integration is complex and sensitive; the app records payments people make elsewhere.                                 |
| —    | Map of past outings | Completed outings appear as pins on a map.                                                         | A fun way to look back, but complex to build and outside the core loop.                                                       |
| —    | AI features         | AI estimates item prices, or reads items and amounts from a receipt photo.                         | Parked until we confirm whether AI API calls are allowed in Project 2.                                                        |

## 5. Scope

The first version aims to include all Must Have and Should Have features, built in priority order across three sprints before the November 13 deadline. Could Have features will be added only if time allows, and are the first to be cut. The proposed order is:

- **Sprint 1:** accounts and authentication, group-based access control, groups and invitations, and expense logging and splitting.
- **Sprint 2:** lists, balances, group settle-up and the overview.
- **Sprint 3:** Should Have features, then Could Have features if time allows.

Recurring bills, a group activity log, group messaging, disputing charges, group admin roles, in-app payments, a map of past outings and AI features are out of scope.
