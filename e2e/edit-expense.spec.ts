import { expect, test, type Browser, type Page } from "@playwright/test";

// User flow 4 (AGENTS.md Section 5): the payer edits or deletes an unsettled
// expense, the expense shows it was edited, and only the payer may. Needs the
// local database, like auth.spec.ts.

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
  // The notice shows before the page refreshes, so wait for the member list
  // to have them: the cost form takes its sharers from there.
  await expect(
    page
      .getByRole("heading", { name: /^Members/ })
      .locator("..")
      .getByRole("listitem")
      .filter({ hasText: name }),
  ).toBeVisible();
}

async function logCost(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: /Log a cost/ }).click();
  const dialog = page.getByRole("dialog", { name: "New entry" });
  await dialog.getByLabel("What was it for?").fill(description);
  await dialog.getByLabel("Amount", { exact: true }).fill(amount);
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
}

type Share = { userId: string; shareCents: number };

async function sharesOf(page: Page, groupId: string): Promise<Share[][]> {
  const response = await page.request.get(`/api/groups/${groupId}/expenses`);
  expect(response.status()).toBe(200);
  const { expenses } = await response.json();
  return expenses.map((expense: { shares: Share[] }) => expense.shares);
}

test("the payer edits a cost, it is marked edited, and the other member can only read it", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const ana = await newUser(browser, "Ana");
  const groupId = await createGroup(ana.page, "🏠 Dorm 4B");
  await invite(ana.page, sam.email, "Sam");
  await logCost(ana.page, "Groceries", "45.10");

  const costs = ana.page.getByRole("heading", { name: "Costs" }).locator("..");
  const row = costs.getByRole("listitem").filter({ hasText: "Groceries" });
  await expect(row).toContainText("$45.10");
  await expect(row).toContainText("You paid");
  await expect(row).not.toContainText("Edited");

  // Edit: opens on the saved split, then changes amount and description.
  await row.getByRole("button", { name: "Edit Groceries" }).click();
  const dialog = ana.page.getByRole("dialog", { name: "Edit expense" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("What was it for?")).toHaveValue("Groceries");
  await expect(dialog.getByLabel("Amount", { exact: true })).toHaveValue(
    "45.10",
  );
  await expect(
    dialog.getByRole("radio", { name: "Custom amounts" }),
  ).toBeChecked();
  await expect(dialog.getByLabel("Your share")).toHaveValue("22.55");
  await expect(dialog.getByLabel("Sam's share")).toHaveValue("22.55");
  await expect(dialog.getByText(/You paid/)).toBeVisible();

  await dialog.getByLabel("What was it for?").fill("Big shop");
  await dialog.getByLabel("Amount", { exact: true }).fill("50");
  // The saved amounts no longer add up, so the save is blocked until fixed.
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByText(/The shares add up to/)).toBeVisible();
  await dialog.getByText("Evenly", { exact: true }).click();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  const edited = costs.getByRole("listitem").filter({ hasText: "Big shop" });
  await expect(edited).toBeVisible();
  await expect(edited).toContainText("$50.00");
  await expect(edited).toContainText("Edited");
  const [shares] = await sharesOf(ana.page, groupId);
  expect(shares.map((share) => share.shareCents).sort()).toEqual([2500, 2500]);

  // The other member sees the same cost, locked.
  await sam.page.goto(`/groups/${groupId}`);
  // The bill lists it too (#21), so look in Costs.
  const samRow = sam.page
    .getByRole("region", { name: "Costs" })
    .getByRole("listitem")
    .filter({ hasText: "Big shop" });
  await expect(samRow).toContainText("Ana paid");
  await expect(samRow).toContainText("Only Ana can edit this");
  await expect(samRow.getByRole("button", { name: /Edit/ })).toHaveCount(0);

  // And the API refuses Sam too.
  const forbidden = await sam.page.request.delete(
    `/api/groups/${groupId}/expenses/${(await expenseIds(sam.page, groupId))[0]}`,
  );
  expect(forbidden.status()).toBe(403);
});

async function expenseIds(page: Page, groupId: string): Promise<string[]> {
  const response = await page.request.get(`/api/groups/${groupId}/expenses`);
  const { expenses } = await response.json();
  return expenses.map((expense: { id: string }) => expense.id);
}

test("deleting asks first; Cancel keeps the cost and confirming removes it", async ({
  page,
}) => {
  await register(page, "Jo", uniqueEmail("jo"));
  await createGroup(page, "✈️ Trip");
  await logCost(page, "Tickets", "120");

  const row = page
    .getByRole("region", { name: "Costs" })
    .getByRole("listitem")
    .filter({ hasText: "Tickets" });
  await row.getByRole("button", { name: "Edit Tickets" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit expense" });
  await dialog.getByRole("button", { name: "Delete…" }).click();

  const confirm = page.getByRole("dialog", {
    name: "Delete Tickets? Its $120.00 comes off everyone's balance.",
  });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  // One Escape closes one layer: the edit form is still open.
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Delete…" }).click();
  await confirm.getByRole("button", { name: "Delete expense" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("No costs yet")).toBeVisible();
});
