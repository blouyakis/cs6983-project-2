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

These are the planned component names. None exist yet. Every amount goes through `MoneyText`, and every form follows `FormSheet`.

### Shared

- **MoneyText** formats cents as dollars with `Intl.NumberFormat` and writes the meaning in words: "you owe", "Sam is owed", "Jo owes". Short forms such as "owe $31.00" on a group card still use words.
- **FormSheet** holds every form. On a phone it fills the screen, with a close or back button at the top left and Cancel and the one primary button pinned to the bottom. On desktop it opens as a dialog. It moves focus to the first field, traps focus, and closes with Escape or Cancel. Field errors appear under the field and are announced with `aria-live="polite"`.
- **Avatar** is a round circle with the member's initial. Fills cycle through `avatar-1`, `avatar-2` and `avatar-3`.
- **Badge** is small uppercase text in `owe` on `tag`, such as READ ONLY, CLOSED or LOGGED AS PERSONAL EXPENSE. A balance badge in a member list uses `tag` for "owes $31" and a light green for "is owed $42".
- **Toggle** is a two-option switch, such as Plan it / Already spent or Evenly / Custom amounts. The selected option is filled with `ink`.
- **ChipPicker** is a row of chips for picking a group, or for picking who shares a cost. A selected chip is filled with `ink`, and in a multi-select it shows a check mark.

### Navigation

- **AppSidebar** is the desktop navigation. It has the LifeBoard logo, then Overview, Lists, Settle up and Groups. The current page sits on `surface` with `owe` text. Below are the user's groups, each with its emoji and balance in words, then the personal space, then a New group button. The selected group is filled with `ink`.
- **TabBar** is the phone navigation along the bottom: Overview, Lists, Settle up and Groups. The current tab is raised on `surface` with `owe` text.
- **PageHeader** has a back button on phone screens, the page's emoji and title, and one line of context, such as "Dorm 4B · period since Oct 1". Group pages add the members' avatars.

### Overview and groups

- **OverviewHeadline** on desktop states the net balance as one sentence, "You owe $23.50 across your groups.", with the amount in `owe`. Below it are the date and the totals owed each way. An Add a plan or cost button sits at the right.
- **BalanceSummary** is the phone version: You owe and You're owed side by side, the net across all groups in words, and a Settle button.
- **GroupCard** shows the group's emoji tile, name, members, split default such as "even split" or "60/40 default", open items, and the user's balance in words. Its buttons are Open, Add plan here, and a settle-up icon button. The overview and the Groups page both use it.
- **CornerChips** is the phone overview's horizontal row of the personal space and each group, each with its spending or balance.
- **PersonalSpaceCard** says the space is private, with its open items and this month's spending. It links to the personal list.
- **ArchivedGroupCard** has a dashed border and a READ ONLY badge, and says when the user left: "You left Sep 2 · you can read everything up to that day, add nothing."
- **SpendingStats** has three cards: personal spending this month, the user's share in groups this period, and the total. The total card is filled with `ink`.
- **ExpenseTable** has the columns Date, Expense, Group, Paid by, Total, Your share and Edit. The Edit column shows a pencil button on expenses the user paid that are still unsettled, and a lock on the rest. A legend under the table explains both. Above it, **ExpenseFilters** has Group, Paid by, From and To, and the count of matching expenses. Export CSV is a Could Have, so leave it out until the Should Haves are done.

### Lists

- **ListStats** sits above a group list: still to buy, spent, and spent versus estimate. The personal list shows planned and spent this month.
- **ListItemRow** shows a checkbox, the item's emoji and title, who added it, and the estimate, written like "~$12.00", or a dash for no cost. A done row is checked and struck through, and shows who paid, the actual cost in `action` green, and the day. A done personal row adds a LOGGED AS PERSONAL EXPENSE badge. Checking an open row off opens the check-off form.
- **EntryForm** is the New entry form. Plan it adds to a list, and Already spent logs a cost. The user picks the group with a `ChipPicker`, then a title, an estimated cost and a day, which defaults to today. Group entries include a `SplitEditor`, marked APPLIES WHEN TICKED for a plan. The personal space has no split. The primary button is Add to list for a plan.
- **LogCostPrompt** is a dashed card on the personal list, "Spent something not on the list?", with a Log cost button.
- **SplitEditor** is titled "How is it split?". It has an Evenly / Custom amounts `Toggle` and a Shared by `ChipPicker` with every member selected by default. A preview lists each share, marks the payer, and shows a leftover cent, as in "You (+1¢ leftover) $3.74". Custom amounts start from the group's default split ratio if one is set, and saving is blocked until they add up to the total. The preview is for display only, and the server recomputes the shares on save.
- **EditExpenseForm** says which group and period the expense is in, and that the user can edit it because they paid. It has the description, the amount with minus and plus buttons, the date, and a `SplitEditor`. Who paid is shown as text and can't be changed. A dashed danger card holds Delete…, which asks for confirmation first. The buttons are Cancel and Save changes. An edited expense shows an "Edited" badge wherever it is listed.

### Money

- **ItemizedBill** lists only the expenses the user shares. Each row has the expense, who paid and when, the user's share in `owe`, and a pencil button or a lock as in `ExpenseTable`. Period chips switch between the open period and each closed month. Below the rows is one line per person, like "You owe Sam $31.00". The desktop version adds a Settle up button.
- **StandingsCard** is titled "Where everyone stands". Each row has an avatar, a name, a bar and the balance in words. Owing fills the bar in `owe`, and being owed fills it in `action` green. The bar is decorative and hidden from screen readers. A footnote gives the number of unsettled expenses and links to the itemized bill.
- **PaymentCard** is one suggested payment, written "You → Sam" with the amount. The header gives the count, such as "2 payments, not 6". Its status reads "Suggested · pay however you like" until the payer marks it with I paid this. Then it reads "Marked paid · waiting for Sam to confirm", and the recipient confirms it. A card the user has to act on has the `owe` offset shadow. The period closes when every payment is confirmed.
- **PayDirectlyCard** is a dashed card, "Pay one person directly · between settle-ups, one payment at a time", with a Pay button that opens the payment form.
- **PastPeriods** shows one card per closed period, with its expense and payment counts and a CLOSED badge.
- Settle-up screens end with the note "LifeBoard records payments you make elsewhere (Venmo, cash…). It never moves money."

### Members

- **MemberList** is titled "Members · all equal, anyone can invite". Each row has an avatar, a name and a balance `Badge`.
- **InviteForm** is an email field with an Invite button. It is not shown in the personal space.
- **MovingOutCard** has a dashed `owe` border and says "You can leave once your balance is $0.00, through a group settle-up or a direct payment." Its buttons are Settle my $31 first and Leave group. Leave group stays disabled until the balance is zero.

## Do's and Don'ts

- Do reuse the components above before making a new row, amount or form.
- Do mark each group with its emoji, not a color.
- Do give every icon-only button an accessible name, such as "Settle up Dorm 4B" or "Edit Paper towels". Emoji next to text are decorative and hidden from screen readers.
- Don't show owing or being owed by color alone.
- Don't put more than one filled button in a form. Cancel stays an outline.
