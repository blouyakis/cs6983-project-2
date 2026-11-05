import { expect, test, type Browser, type Page } from "@playwright/test";

// Settle up (#19, user flow 5): a member starts a settle-up, the app suggests
// the fewest payments, the payer marks one paid, the recipient confirms it,
// and the period closes with balances back at zero. Needs the local database,
// like balances.spec.ts.

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
}

async function newUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await register(page, name, email);
  return { page, email };
}

function memberRow(page: Page, name: string) {
  return page
    .getByRole("heading", { name: /^Members/ })
    .locator("..")
    .getByRole("listitem")
    .filter({ hasText: name });
}

function standingsRow(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Where everyone stands" })
    .getByRole("listitem")
    .filter({ hasText: name });
}

function paymentCards(page: Page) {
  return page
    .getByRole("region", { name: "Fewest payments" })
    .getByRole("listitem");
}

// Ana and Sam share a group where Ana paid $45.10 for both. Returns the
// group's id.
async function groupWithDebt(
  ana: { page: Page },
  sam: { page: Page; email: string },
): Promise<string> {
  await ana.page.goto("/groups");
  await ana.page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = ana.page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill("🏠 Dorm 4B");
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();
  // The notice shows before the page refreshes, so wait for Sam to be in the
  // member list: the cost form takes its sharers from there.
  await expect(memberRow(ana.page, "Sam")).toBeVisible();

  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = ana.page.getByRole("dialog", { name: "New entry" });
  await entry.getByLabel("What was it for?").fill("Groceries");
  await entry.getByLabel("Amount", { exact: true }).fill("45.10");
  await entry.getByRole("button", { name: "Add expense" }).click();
  await expect(entry).toBeHidden();

  return ana.page.url().split("/").pop() as string;
}

test("start a settle-up, pay and confirm the one suggested payment, and the period closes", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const groupId = await groupWithDebt(ana, sam);
  const settleUpUrl = `/groups/${groupId}/settle-up`;

  // The group page links to the settle-up screen, which shows the standings.
  await ana.page.getByRole("link", { name: /Settle up 🏠 Dorm 4B/ }).click();
  await expect(ana.page).toHaveURL(settleUpUrl);
  await expect(
    ana.page.getByRole("heading", { level: 1, name: /Settle up · 🏠 Dorm 4B/ }),
  ).toBeVisible();
  await expect(ana.page.getByText(/1 unsettled expense/)).toBeVisible();
  await expect(standingsRow(ana.page, "You (Ana)")).toContainText(
    "You are owed $22.55",
  );
  await expect(standingsRow(ana.page, "Sam")).toContainText("Sam owes $22.55");

  // Ana starts the settle-up: one payment, Sam → Ana.
  await ana.page.getByRole("button", { name: /Start settle-up/ }).click();
  await expect(ana.page.getByRole("status")).toHaveText(
    "Settle-up started: 1 payment to make.",
  );
  await expect(paymentCards(ana.page)).toHaveCount(1);
  const anaCard = paymentCards(ana.page).first();
  await expect(anaCard).toContainText("Sam → You");
  await expect(anaCard).toContainText("$22.55");
  await expect(anaCard).toContainText("waiting for Sam to pay");
  await expect(anaCard.getByRole("button")).toHaveCount(0);

  // A second settle-up is refused while this one is open.
  const again = await ana.page.request.post(
    `/api/groups/${groupId}/settlements`,
  );
  expect(again.status()).toBe(409);

  // Sam sees the payment from his side and marks it paid.
  await sam.page.goto(settleUpUrl);
  const samCard = paymentCards(sam.page).first();
  await expect(samCard).toContainText("You → Ana");
  await expect(samCard).toContainText("pay however you like");
  await samCard.getByRole("button", { name: /I paid this/ }).click();
  await expect(sam.page.getByRole("status")).toHaveText(
    "Marked paid. Ana can confirm it now.",
  );
  await expect(paymentCards(sam.page).first()).toContainText(
    "waiting for Ana to confirm",
  );
  // Once marked paid, the settle-up can no longer be cancelled.
  await expect(
    sam.page.getByRole("button", { name: "Cancel settle-up" }),
  ).toHaveCount(0);

  // Ana confirms it, and that closes the period.
  await ana.page.reload();
  await expect(paymentCards(ana.page).first()).toContainText(
    "waiting for you to confirm",
  );
  await paymentCards(ana.page)
    .first()
    .getByRole("button", { name: /I got it/ })
    .click();
  await expect(ana.page.getByRole("status")).toHaveText(
    "Confirmed. That was the last one: the period is closed.",
  );
  await expect(standingsRow(ana.page, "You (Ana)")).toContainText(
    "You are all settled up",
  );
  await expect(ana.page.getByText("No settle-up is open.")).toBeVisible();
  await expect(ana.page.getByText(/0 unsettled expenses/)).toBeVisible();
  const pastPeriods = ana.page.getByRole("region", { name: "Past periods" });
  await expect(pastPeriods.getByRole("listitem")).toHaveCount(1);
  await expect(pastPeriods).toContainText("1 expense · 1 payment");

  // The settled expense is locked: editing it is a conflict.
  const expenses = await ana.page.request.get(
    `/api/groups/${groupId}/expenses`,
  );
  const [groceries] = (await expenses.json()).expenses;
  expect(groceries.settled).toBe(true);
  const edit = await ana.page.request.patch(
    `/api/groups/${groupId}/expenses/${groceries.id}`,
    {
      data: {
        description: "Groceries",
        amountCents: 4510,
        spentOn: groceries.spentOn,
        mode: "even",
        sharedBy: groceries.shares.map((s: { userId: string }) => s.userId),
      },
    },
  );
  expect(edit.status()).toBe(409);
});

test("cancelling a settle-up asks first and leaves the costs unsettled", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const groupId = await groupWithDebt(ana, sam);

  await ana.page.goto(`/groups/${groupId}/settle-up`);
  await ana.page.getByRole("button", { name: /Start settle-up/ }).click();
  await expect(paymentCards(ana.page)).toHaveCount(1);

  await ana.page.getByRole("button", { name: "Cancel settle-up" }).click();
  const dialog = ana.page.getByRole("dialog");
  await expect(dialog).toContainText("Cancel this settle-up?");
  await dialog.getByRole("button", { name: "Yes, cancel it" }).click();

  await expect(ana.page.getByRole("status")).toHaveText(
    "Settle-up cancelled. The costs stay unsettled.",
  );
  await expect(ana.page.getByText("No settle-up is open.")).toBeVisible();
  await expect(standingsRow(ana.page, "Sam")).toContainText("Sam owes $22.55");
  await expect(ana.page.getByText(/1 unsettled expense/)).toBeVisible();

  // And it can be started again.
  await ana.page.getByRole("button", { name: /Start settle-up/ }).click();
  await expect(paymentCards(ana.page)).toHaveCount(1);
});
