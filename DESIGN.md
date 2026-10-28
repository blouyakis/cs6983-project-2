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

- **ListItemRow** shows the title, who added it, and an optional estimated cost. Checking it off opens the check-off dialog. A done row shows who paid, the actual cost, the date, and the estimate.
- **MoneyText** formats cents as dollars with `Intl.NumberFormat` and writes the meaning in words: "you owe", "Alex is owed", "Jordan owes".

## Do's and Don'ts

- Do reuse `ListItemRow` and `MoneyText` before making a new row or amount.
- Do keep one group color to that group's bar and header.
- Don't show owing or being owed by color alone.
- Don't put more than one filled action button in a dialog. Cancel stays an outline.
