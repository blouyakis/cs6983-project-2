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

Colors were sampled from the first set of mockups, which the current screens in `docs/design/` replaced. They have not been re-sampled yet.

## Screens

Each screen has a desktop mockup, a phone mockup, or both. Desktop has a sidebar. Phone has a bottom tab bar with Overview, Lists, Settle up and Groups.

- **Overview:** [desktop](docs/design/desktop-overview.png) and [phone](docs/design/overview.png). The net balance across groups as one sentence, a card per group with its balance in words, and this month's spending. Desktop adds the expense table with Group, Paid by, From and To filters. Phone adds the personal list and an Add a plan button.
- **Groups:** [desktop](docs/design/desktop-groups.png) and [phone](docs/design/groups-new-group.png). The personal space first, then one card per shared group with its members, split default, open items and balance. Groups the user left or that were archived are read-only, below the rest.
- **One group:** [desktop](docs/design/desktop-group.png). Still to buy, spent, and spent versus estimate. The shared list, the itemized bill, an invite field, and a Moving out panel. Leave group stays disabled until the balance is $0.00.
- **Shared list:** [phone](docs/design/shared-list.png). Every member sees the same list. Open items show who added them and an estimate. Done items show who paid, the actual cost and the day.
- **Members and bill:** [phone](docs/design/group-members.png). Each member's balance in words, an invite field, and the itemized bill. The bill lists only expenses the user shares, for the open period or a closed one. The user's own expenses have an edit button, and other people's show a lock.
- **Settle up:** [desktop](docs/design/desktop-settle-up.png) and [phone](docs/design/settle-up.png). Where everyone stands, then the fewest payments. The payer marks a payment paid, and the recipient confirms it. Pay one person directly sits below. Desktop also lists closed past periods.
- **New entry:** [phone](docs/design/add-plan.png). One form with two modes: Plan it adds to a list, and Already spent logs a cost. The user picks the group, a title, an estimated cost and a day. The split is even or custom, with a live preview where leftover cents go to the payer.
- **Edit expense:** [phone](docs/design/edit-expense.png). Description, amount, date, who paid, who shares it, and the split. Only the payer can edit or delete it, and only until it is settled.
- **Personal space:** [phone](docs/design/personal-list.png). Private, with nothing split or shared. Planned total and spending this month. Ticking an item logs it as a personal expense, and Log cost records one that was never on the list.

No mockup exists yet for checking off an item, the Pay one person directly form, the full group expense list, personal expenses, or the new group form.

The mockups include demo controls that are not part of the app: Simulate Sam confirming and the Preview: settled toggle. Don't build them.

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
