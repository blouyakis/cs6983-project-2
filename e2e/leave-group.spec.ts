import { expect, test, type Browser, type Page } from "@playwright/test";

// User flow 8 (AGENTS.md Section 5, #22): a member with a zero balance leaves,
// keeps read-only access to the history up to that day, and the member who
// stays keeps using the group. When the last member leaves, the group is
// archived. Needs the local database, like auth.spec.ts.

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

async function createGroup(page: Page, name: string): Promise<string> {
  await page.goto("/groups");
  // The sidebar has a New group button too (#53), so look inside the page.
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
}

async function invite(page: Page, email: string, name: string) {
  const form = page.getByRole("form", { name: "Invite a member" });
  await form.getByLabel("Email").fill(email);
  await form.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`${name} joined the group.`)).toBeVisible();
  // The cost form takes its sharers from the member list, so wait for it.
  await expect(
    page
      .getByRole("heading", { name: /^Members/ })
      .locator("..")
      .getByRole("listitem")
      .filter({ hasText: name }),
  ).toBeVisible();
}

// A cost the user paid, split evenly with everyone in the group.
async function logCost(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: /Log a cost/ }).click();
  const dialog = page.getByRole("dialog", { name: "New entry" });
  await dialog.getByLabel("What was it for?").fill(description);
  await dialog.getByLabel("Amount", { exact: true }).fill(amount);
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
}

function costs(page: Page) {
  return page.getByRole("heading", { name: "Costs" }).locator("..");
}

function movingOut(page: Page) {
  return page.getByRole("region", { name: "Moving out?" });
}

test("a member leaves at zero, keeps read-only history, and the last one to leave archives the group", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const ren = await newUser(browser, "Ren");
  const groupId = await createGroup(ana.page, "🏠 Dorm 4B");
  await invite(ana.page, ren.email, "Ren");
  await logCost(ana.page, "Groceries", "20");

  // Ren owes $10.00, so he can't leave yet and is told why, in words.
  await ren.page.goto(`/groups/${groupId}`);
  const card = movingOut(ren.page);
  await expect(card).toContainText("You owe $10.00 in this group.");
  const leave = card.getByRole("button", { name: "Leave group" });
  await expect(leave).toBeDisabled();
  await expect(
    card.getByRole("link", { name: /Settle my \$10\.00 first/ }),
  ).toHaveAttribute("href", `/groups/${groupId}/settle-up`);

  // He pays for the next shop, which evens him out.
  await logCost(ren.page, "Toilet paper", "20");
  await expect(card.getByRole("link", { name: /Settle my/ })).toHaveCount(0);
  await expect(leave).toBeEnabled();

  // Leaving asks first, and Cancel keeps him in.
  await leave.click();
  const confirm = ren.page.getByRole("dialog", { name: /^Leave 🏠 Dorm 4B\?/ });
  await expect(confirm).toContainText(
    "You'll keep read-only access to its history up to today.",
  );
  await expect(confirm).not.toContainText("archive");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();

  await leave.click();
  await confirm.getByRole("button", { name: "Leave group" }).click();
  await expect(ren.page).toHaveURL("/groups");
  await expect(
    ren.page.getByRole("link", { name: /🏠 Dorm 4B/ }).filter({
      hasText: /You left .* add nothing/,
    }),
  ).toBeVisible();

  // Ana keeps using the group on her own.
  await ana.page.reload();
  await logCost(ana.page, "Light bulbs", "6");
  await expect(
    costs(ana.page).getByRole("listitem").filter({ hasText: "Light bulbs" }),
  ).toBeVisible();
  // Ren keeps the balance he left with, so the costs he shares are locked
  // until a settle-up claims them, and the lock says why.
  const groceries = costs(ana.page)
    .getByRole("listitem")
    .filter({ hasText: "Groceries" });
  await expect(groceries).toContainText("Shared with someone who left");
  await expect(groceries.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  await expect(
    costs(ana.page)
      .getByRole("listitem")
      .filter({ hasText: "Light bulbs" })
      .getByRole("button", { name: "Edit Light bulbs" }),
  ).toBeVisible();

  // Ren reads what was there before he left, not what was added after, and
  // can add nothing.
  await ren.page.goto(`/groups/${groupId}`);
  await expect(ren.page.getByText("Read only").first()).toBeVisible();
  const renCosts = costs(ren.page);
  await expect(
    renCosts.getByRole("listitem").filter({ hasText: "Groceries" }),
  ).toBeVisible();
  await expect(
    renCosts.getByRole("listitem").filter({ hasText: "Toilet paper" }),
  ).toBeVisible();
  await expect(
    renCosts.getByRole("listitem").filter({ hasText: "Light bulbs" }),
  ).toHaveCount(0);
  await expect(
    ren.page.getByRole("button", { name: /Log a cost/ }),
  ).toHaveCount(0);
  await expect(movingOut(ren.page)).toHaveCount(0);

  // Ana's last cost was hers alone, so she is at zero too. As the last
  // member, leaving archives the group.
  await ana.page.reload();
  await movingOut(ana.page)
    .getByRole("button", { name: "Leave group" })
    .click();
  const last = ana.page.getByRole("dialog", { name: /^Leave 🏠 Dorm 4B\?/ });
  await expect(last).toContainText(
    "As its last member, you'll archive the group.",
  );
  await last.getByRole("button", { name: "Leave group" }).click();
  await expect(ana.page).toHaveURL("/groups");
  await expect(
    ana.page.getByRole("link", { name: /🏠 Dorm 4B/ }).filter({
      hasText: "Read only",
    }),
  ).toBeVisible();
  await ana.page.goto(`/groups/${groupId}`);
  await expect(ana.page.getByText("Read only").first()).toBeVisible();
  await expect(movingOut(ana.page)).toHaveCount(0);
});

test("a personal space has no Moving out card", async ({ browser }) => {
  const { page } = await newUser(browser, "Bo");
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Personal/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(movingOut(page)).toHaveCount(0);
});
