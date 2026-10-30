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

- **ListItemRow** shows the title, who added it, and an optional estimated cost. Checking it off opens the check-off dialog. A done row shows who paid, the actual cost, the date, and the estimate.
- **MoneyText** formats cents as dollars with `Intl.NumberFormat` and writes the meaning in words: "you owe", "Alex is owed", "Jordan owes".

## Do's and Don'ts

- Do reuse `ListItemRow` and `MoneyText` before making a new row or amount.
- Do keep one group color to that group's bar and header.
- Don't show owing or being owed by color alone.
- Don't put more than one filled action button in a dialog. Cancel stays an outline.
