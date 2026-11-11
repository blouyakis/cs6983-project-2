import { expect, test, type Browser, type Page } from "@playwright/test";

// Check my bill (#21, user flow 7): open my bill for a group, see only the
// costs I share, who paid, my share and what I owe each member, then look at
// a past period once a settle-up has closed. Needs the local database, like
// settle-up.spec.ts.

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function newUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  return { page, email };
}

function memberRow(page: Page, name: string) {
  return page
    .getByRole("heading", { name: /^Members/ })
    .locator("..")
    .getByRole("listitem")
    .filter({ hasText: name });
}

function bill(page: Page) {
  return page.getByRole("region", { name: /Your bill/ });
}

// Ana and Sam share a group where Ana paid $30.00 for both. Returns the
// group's id.
async function groupWithGroceries(
  ana: { page: Page },
  sam: { email: string },
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
  // The cost form takes its sharers from the member list.
  await expect(memberRow(ana.page, "Sam")).toBeVisible();

  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = ana.page.getByRole("dialog", { name: "New entry" });
  await entry.getByLabel("What was it for?").fill("Groceries");
  await entry.getByLabel("Amount", { exact: true }).fill("30");
  await entry.getByRole("button", { name: "Add expense" }).click();
  await expect(entry).toBeHidden();
  return ana.page.url().split("/").pop() as string;
}

test("check my bill, then look at it again once the period has closed", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const groupId = await groupWithGroceries(ana, sam);

  // Sam's bill: the one cost he shares, who paid, his share, and what he owes.
  await sam.page.goto(`/groups/${groupId}`);
  const samBill = bill(sam.page);
  const groceries = samBill.getByRole("listitem", { name: "Groceries" });
  await expect(groceries).toContainText(/Ana paid · /);
  await expect(groceries).toContainText("Your share $15.00");
  await expect(groceries).toContainText("of $30.00");
  await expect(groceries).toContainText("Only Ana can edit this");
  await expect(
    samBill.getByRole("list", { name: "What you owe each member" }),
  ).toHaveText("You owe Ana $15.00");
  await expect(samBill).toContainText("In all, you owe $15.00");
  // The settle-up page's footnote links back to the bill.
  await sam.page.goto(`/groups/${groupId}/settle-up`);
  await sam.page.getByRole("link", { name: "1 unsettled expense" }).click();
  await expect(sam.page).toHaveURL(`/groups/${groupId}#bill`);

  // The API gives the same bill.
  const response = await sam.page.request.get(
    `/api/groups/${groupId}/bills/me`,
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.lines).toHaveLength(1);
  expect(body.lines[0]).toMatchObject({
    description: "Groceries",
    shareCents: 1500,
  });
  expect(body.owed).toEqual([expect.objectContaining({ owedCents: 1500 })]);

  // The period closes: Ana starts a settle-up, Sam pays, Ana confirms.
  const started = await ana.page.request.post(
    `/api/groups/${groupId}/settlements`,
  );
  expect(started.status()).toBe(201);
  const [payment] = (await started.json()).settleUp.payments;
  expect(
    (
      await sam.page.request.post(
        `/api/groups/${groupId}/payments/${payment.id}/paid`,
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await ana.page.request.post(
        `/api/groups/${groupId}/payments/${payment.id}/confirm`,
      )
    ).status(),
  ).toBe(200);

  // The new period has nothing of Sam's yet.
  await sam.page.goto(`/groups/${groupId}`);
  await expect(bill(sam.page)).toContainText(
    "You aren't part of any cost in this period.",
  );
  await expect(bill(sam.page)).toContainText("In all, you're even.");

  // The past period still has the groceries, locked as settled.
  const chips = bill(sam.page).getByRole("navigation", { name: "Bill period" });
  await expect(chips.getByRole("link")).toHaveCount(2);
  await chips.getByRole("link").nth(1).click();
  await expect(sam.page).toHaveURL(/\?period=[0-9a-f-]{36}#bill$/);
  const past = bill(sam.page).getByRole("listitem", { name: "Groceries" });
  await expect(past).toContainText("Your share $15.00");
  await expect(past).toContainText("Settled");
  await expect(bill(sam.page)).toContainText(
    "This period is closed: everything in it was paid.",
  );
  await expect(chips.getByRole("link").nth(1)).toHaveAttribute(
    "aria-current",
    "page",
  );
});
