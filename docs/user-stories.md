# User Stories: LifeBoard

CS6983 AI Coding, Project 2. Barbara Louyakis and Ziye Huang.

The Story column in the [PRD](PRD.md) uses these numbers. Priorities are in the PRD.

## US-1 — Shared vs. personal expenses (Dorm roommate)

As a college student sharing a dorm with three roommates, I want to log shared and personal expenses in one place and see what I owe or am owed, so that I can plan my spending without a separate group chat or spreadsheet.

Acceptance criteria:

- I can create a group (e.g., “Dorm 4B”) and invite roommates by email.
- I can log an expense as personal or assign it to a group.
- A group expense can be split evenly or by custom amounts across members.
- My dashboard shows my personal total, my share of each group, and a net “you owe / you are owed” balance.
- I can filter expenses by group, by person, and by date range.

## US-2 — Planning to-dos with cost (Traveler)

As a young professional who likes to travel, I want to keep a to-do list where each item can carry an estimated cost and belong to a trip or outing, so that I can see what my plans will add up to before I commit to them.

Acceptance criteria:

- I can create an outing/trip group and add to-do items to it.
- Each to-do item has an optional estimated cost.
- The group shows a running total of estimated costs for open items.
- When I mark an item done, I can confirm or edit the actual cost and it is recorded as an expense.
- I can see estimated vs. actual totals for the group.

## US-3 — Split costs with a co-parent (Single parent)

As a single parent working full time, I want to track childcare costs that I split with my co-parent alongside my own household expenses, so that I have an accurate record of who paid what without tracking it by hand.

Acceptance criteria:

- I can create a two-person group with a fixed split ratio (e.g., 50/50 or 60/40) that applies by default to new expenses.
- I can override the split on an individual expense.
- I can record a settlement payment and the balance updates accordingly.
- I can export or view a history of expenses and settlements for the group over a date range.
- My household expenses stay separate from the shared group but appear in my personal dashboard totals.

## US-4 — Account creation and secure login (New user)

As a new user, I want to create an account and log in securely, so that my expenses and groups are private to me and I can only see data from groups I belong to.

Acceptance criteria:

- I can register with an email and password; the password is stored hashed, never in plain text.
- Registration rejects a duplicate email and a password shorter than 8 characters, with a clear error message.
- I can log in and receive a JWT; the token expires and I am prompted to log in again when it does.
- Protected pages (dashboard, groups, expenses) redirect to the login page when I am not authenticated.
- API requests without a valid token return 401.
- I can only read or modify expenses and to-dos in groups I am a member of.
- I can log out, which invalidates my session on the client.

## US-5 — Shared shopping list and household bills (Roommate who does the grocery run)

As a roommate who often buys groceries and pays household bills like utilities, I want a shared list for things we plan to buy and a quick way to record costs after they happen, so that my roommates see what’s been bought or paid and the cost lands in their bills automatically.

Acceptance criteria:

- Any group member can add an item to the group’s shared list (e.g., groceries, toilet paper, internet bill), with an optional quantity and note.
- All members see the same list, including who added each item and its status (needed / bought).
- When I check off an item as bought, I enter the actual price and select which members share it (default: all members).
- I can also add a shared cost directly after it happens (e.g., this month’s electricity bill, an unplanned purchase, or a roommate dinner cost), without putting it on the list first.
- Either way, the cost is recorded as a group expense with me as the payer, split among the selected members.
- For bought items, all members can see who bought them, how much they cost, and when.
- I can edit or delete an expense I paid for until it is settled, and the change is recorded in the group’s history.

## US-6 — Who owes whom and settle up (Roommate who handles the money)

As the roommate who usually sorts out money at the end of the month, I want the app to calculate the simplest set of payments that clears everyone’s balances, so that we can settle up in as few transfers as possible without doing the math by hand.

Acceptance criteria:

- The group page shows each member’s net balance across all unsettled expenses.
- The app suggests the fewest possible payments that bring every balance to zero (e.g., “Alex pays Sam $23.50”).
- Any member can start a “settle up” for the group at any time.
- Each member can mark a suggested payment as paid, and the recipient can confirm it.
- When all payments are confirmed, the period closes, balances reset to zero, and the settled expenses are kept in history.
- Before a group settle-up, a member can also pay another member directly, one payment at a time; once the recipient confirms, both members’ balances update and the suggested payments are recalculated.

## US-7 — Reviewing my bill (Roommate who wants to check charges)

As a roommate who didn’t make most of the purchases, I want to see an itemized bill of everything I’ve been charged for, so that I can check that each charge is fair before I pay.

Acceptance criteria:

- I can view my bill for a group: each expense I’m included in, who paid, the total, and my share.
- The bill shows my running total owed to each roommate.
- I can view past bills from previous settle-up periods.

## US-8 — Moving out of a group (Roommate who is moving out)

As a roommate who is moving out, I want to settle up and leave our group cleanly, so that the remaining roommates can keep using the group and I still have a record of what I paid.

Acceptance criteria:

- Any member can invite new members to the group.
- A member can leave the group only after their balance is settled; otherwise they are prompted to settle up first.
- A member who leaves keeps read-only access to the group’s history up to the date they left, including their expenses and settlements.
- A member who leaves cannot add or edit expenses and cannot see anything added after they left.
- The remaining members can still see the departed member’s past expenses in the group’s history.
