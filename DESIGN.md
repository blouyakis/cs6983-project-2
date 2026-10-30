---
name: LifeBoard
colors:
  canvas: "#FFF4C2"
  sidebar: "#FFE98A"
  surface: "#FFFBE7"
  ink: "#2A2418"
  muted: "#6B6246"
  action: "#2B5E3C"
  owe: "#A6304F"
  divider: "#E3D58F"
  tag: "#F9DFDE"
  disabled: "#EDE4B8"
  avatar-1: "#FFE98A"
  avatar-2: "#F8DCE3"
  avatar-3: "#CFE6D4"
---

## Overview

Warm and playful. The page is `canvas` cream. The desktop sidebar and the phone tab bar are `sidebar` yellow. Cards are `surface` with a thick `ink` border, and dashed `divider` lines separate their rows. Highlighted cards and primary buttons sit on a solid offset shadow.

Each group has an emoji in a yellow tile, not a color. Members have round initial avatars in the three avatar colors.

Owing is `owe` maroon and being owed is `action` green, always written in words. Green is also the color of the primary button. `ink` fills the selected chip, toggle option and group. Badges such as READ ONLY and CLOSED use `owe` text on `tag`.

Colors were sampled from the mockups in `docs/design/` on Oct 29. Every text color has at least 4.5:1 contrast on `canvas`, `sidebar` and `surface`. Don't put `owe` text on `ink`, because that contrast is too low.

## Screens

Each screen has a desktop mockup, a phone mockup, or both. Desktop has a sidebar. Phone has a bottom tab bar with Overview, Lists, Settle up and Groups.

- **Overview:** [desktop](docs/design/desktop-overview.png) and [phone](docs/design/overview.png). The net balance across groups as one sentence, a card per group with its balance in words, and this month's spending. Desktop adds the expense table with Group, Paid by, From and To filters. Phone adds the personal list and an Add a plan button.
- **Groups:** [desktop](docs/design/desktop-groups.png) and [phone](docs/design/groups-new-group.png). The personal space first, then one card per shared group with its members, split default, open items and balance. Groups the user left or that were archived are read-only, below the rest.
- **One group:** [desktop](docs/design/desktop-group.png). Still to buy, spent, and spent versus estimate. The shared list, the itemized bill, an invite field, and a Moving out panel. Leave group stays disabled until the balance is $0.00.
- **Shared list:** [phone](docs/design/shared-list.png). Every member sees the same list. Open items show who added them and an estimate. Done items show who paid, the actual cost and the day.
- **Members and bill:** [phone](docs/design/group-members.png). Each member's balance in words, an invite field, and the itemized bill. The bill lists only expenses the user shares, for the open period or a closed one. The user's own expenses have an edit button, and other people's show a lock.
- **Settle up:** [desktop](docs/design/desktop-settle-up.png) and [phone](docs/design/settle-up.png). Where everyone stands, then the fewest payments. The payer marks a payment paid, and the recipient confirms it. Pay one person directly sits below. Desktop also lists closed past periods.
- **New entry:** [phone](docs/design/add-plan.png). One form with two modes: Plan it adds to a list, and Already spent logs a cost. The user picks the group, a title, an estimated cost and a day. The split is even or custom, with a live preview where leftover cents go to the payer.
- **Edit expense:** [phone](docs/design/edit-expense.png). Description, amount, date, who shares it, and the split. Only the payer can edit or delete it, and only until it is settled. Who paid is shown but can't be changed. Don't build the mockup's Paid by picker. To fix the payer, delete the expense and add it again.
- **Personal space:** [phone](docs/design/personal-list.png). Private, with nothing split or shared. Planned total and spending this month. Ticking an item logs it as a personal expense, and Log cost records one that was never on the list.

No mockup exists yet for checking off an item, the Pay one person directly form, the full group expense list, personal expenses, or the new group form.

The mockups include demo controls that are not part of the app: Simulate Sam confirming and the Preview: settled toggle. Don't build them.

Some mockups show a balance as a signed amount in color, such as −$31.00 on the settle-up screens or −$31 in the sidebar. Build these in words instead: "You owe $31.00", "Sam is owed $42.00". Color alone never shows owing.

## Components

- **ListItemRow** shows the title, who added it, and an optional estimated cost. Checking it off opens the check-off dialog. A done row shows who paid, the actual cost, the date, and the estimate.
- **MoneyText** formats cents as dollars with `Intl.NumberFormat` and writes the meaning in words: "you owe", "Alex is owed", "Jordan owes".

## Do's and Don'ts

- Do reuse `ListItemRow` and `MoneyText` before making a new row or amount.
- Do mark each group with its emoji, not a color.
- Don't show owing or being owed by color alone.
- Don't put more than one filled action button in a dialog. Cancel stays an outline.
