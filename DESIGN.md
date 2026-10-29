---
name: LifeBoard
colors:
  canvas: "#F5F5F3"
  sidebar: "#E2E2E0"
  surface: "#FFFFFF"
  ink: "#1F2825"
  muted: "#5E6462"
  action: "#286850"
  owe: "#984838"
  dorm: "#3B6EA5"
  picnic: "#94600C"
  personal: "#7858A8"
---

## Overview

Calm and everyday. The page is a warm gray, cards are white, and one group keeps one color: a short bar in the sidebar and the group header. Owing and being owed are written in words. The owe color is only for money the person owes. The action green is for being owed and for the one primary button in a dialog.

Colors were sampled from the screenshots in `docs/design/`.

## Screens

- [Overview](docs/design/overview.jpg). What you owe across groups, this month's spending, and a filterable expense list.
- [Group list](docs/design/group-list.jpg). Open and done items, who added each one, and an optional estimate.
- [Check off an item](docs/design/check-off.jpg). Actual cost, date, and who shares it. Even split, or custom amounts. A leftover cent goes to the payer.
- [Add a cost](docs/design/add-cost.jpg). A cost that was never on the list. The current user paid.
- [Add to the list](docs/design/add-to-list.jpg). A title and an optional estimate.
- [Balances and settle-up](docs/design/balances.jpg). Each member's balance in words, then the fewest payments. The payer marks a payment paid. The recipient confirms.
- [Pay someone directly](docs/design/pay-directly.jpg). Record a payment sent outside the app. The recipient confirms later.
- [Group expenses](docs/design/group-expenses.jpg). Every member sees every expense. Only the payer can edit or delete one before it is settled.
- [My bill](docs/design/my-bill.jpg). Only expenses the member shares, for the current or a past period, and what they owe each person.
- [Members](docs/design/members.jpg). Who joined, invite by email, and leave only when the balance is settled.
- [Personal space](docs/design/personal-list.jpg) and [its expenses](docs/design/personal-expenses.jpg). Visible only to the owner. List and expenses, no balances or members.
- [New group](docs/design/new-group.jpg). A name for any part of life shared with others.

## Components

These are the planned component names. None exist yet. Every amount goes through `MoneyText`, and every dialog follows `Dialog`.

### Shared

- **MoneyText** formats cents as dollars with `Intl.NumberFormat` and writes the meaning in words: "you owe", "Alex is owed", "Jordan owes".
- **Dialog** opens over a dimmed page and moves focus to the first field. It traps focus and closes with Escape or Cancel. It has one filled primary button, with Cancel as an outline button beside it. Field errors appear under the field and are announced with `aria-live="polite"`.

### Navigation and group frame

- **AppSidebar** lists Overview, then a "Groups" section, then "Just you" with the personal space, then a New group button. Each entry has its group's color bar. The current page sits on a white background.
- **GroupHeader** is filled with the group color. It shows the group name, the member names, and the viewer's balance in words.
- **GroupActions** are outline buttons: Add a cost, Add to list, Settle up, and Pay someone directly. Settle up reads "View settle-up" while one is in progress.
- **GroupTabs** are List, Expenses, Balances, My bill and Members, with an underline under the current tab. The personal space shows only List and Expenses.

### Lists

- **ListSummary** sits above the list. It gives the number of open items and their estimated total, then the estimated and actual totals of done items.
- **ListItemRow** shows the title, who added it, and an optional estimated cost. Checking it off opens the check-off dialog. A done row shows who paid, the actual cost, the date, and the estimate. The person who added an open item can remove it.
- **CheckOffDialog** is titled with the item, for example Check off "Dish soap". Actual cost starts at the estimate, with a hint to change it to what was paid. Date defaults to today. It says "Paid by you." because the person checking off is always the payer. It contains a `SplitEditor`, and its primary button is Check off.
- **AddCostDialog** is the same form for a cost that was never on the list, with a description field in place of the item title.
- **SplitEditor** is a fieldset titled "Who shares it". It has a Split evenly / Custom amounts toggle and a checkbox for each member, all checked by default. Even mode shows each share as the amount is typed, with the note that any leftover cent goes to the payer. Custom mode shows an amount field per member, starting from the group's default split ratio if one is set. It blocks saving until the amounts add up to the total. The preview is for display only, and the server recomputes the shares on save.

### Money

- **ExpenseTable** has the columns Date, Expense, Paid by, Shared by, Total and Your share. Rows the viewer doesn't share are muted and show "Not included" as their share. Edit and Delete appear only for the payer, and only while the expense is unsettled. An edited expense shows an "Edited" badge. Settled expenses have no actions.
- **BalanceRow** shows a member's name, a bar that grows from a center zero line, and a `MoneyText`. Owing grows left in the owe color, and being owed grows right in the action green. The bar is decorative and hidden from screen readers, so the words carry the meaning.
- **SettleUpCard** has a left border in the group color and the title "Settle-up in progress". A summary line follows: "Started by you on Oct 26. 3 payments clear every balance, the fewest possible. 0 of 3 confirmed." Each payment row reads like "You pay Alex $27.75". The payer sees Mark as paid. After that, the recipient confirms it, and everyone else sees who it is waiting for. The period closes when every payment is confirmed.
- **PayDirectlyDialog** has a To field listing the other members and an Amount field. It explains that the money is sent outside the app, and its primary button is Record payment. The payment counts once the recipient confirms it.
- **MyBill** has a Period select with the current period first, then settled past periods. Below it is one line per member, like "You owe Alex $18.75". Then comes a table of only the expenses the viewer shares, with a "Your total share" footer and a note that the Expenses tab shows everything.

### Overview

- **OverviewHeadline** states the net balance across groups as one sentence: "You owe $67.08 across your groups."
- **GroupSummaryCard** shows the group color bar, name, member count, open items and the viewer's share, with a `MoneyText` on the right. It links to the group.
- **SpendingStats** shows personal spending this month, the viewer's share in groups this period, and the total.
- **ExpenseFilters** sit above the overview's `ExpenseTable`, which adds a Group column. The filters are Group, Paid by, From and To.

### Members

- **MemberList** shows each member's name and the date they joined.
- **InviteForm** is an email field with a Send invitation button. It is not shown in the personal space.
- **LeaveGroup** has a Leave button named after the group. It stays disabled until the viewer's balance is zero, with a line saying why: "You can leave once your balance is settled. You owe $58.25 right now."

## Do's and Don'ts

- Do reuse the components above before making a new row, amount or dialog.
- Do keep one group color to that group's bar and header.
- Don't show owing or being owed by color alone.
- Don't put more than one filled action button in a dialog. Cancel stays an outline.
- Don't build the "Demo: mark paid as Jordan" link from the balances mockup. It is a prototype shortcut. Each payer marks their own payment.
