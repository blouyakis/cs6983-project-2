import { expect, test, type Browser, type Page } from "@playwright/test";

// User flow 3 (AGENTS.md Section 5): add a cost that was never on a list,
// choose an even or custom split, and have it saved. Needs the local
// database, like groups.spec.ts.

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

// Creates a group and lands on its page. Returns the group's id.
async function createGroup(page: Page, name: string): Promise<string> {
  await page.goto("/groups");
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
}

type Expense = {
  amountCents: number;
  payerId: string;
  description: string;
  shares: { userId: string; shareCents: number }[];
};

async function expensesOf(page: Page, groupId: string): Promise<Expense[]> {
  const response = await page.request.get(`/api/groups/${groupId}/expenses`);
  expect(response.status()).toBe(200);
  return (await response.json()).expenses;
}

test("log a cost, split it evenly or by custom amounts, and both members see it", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const ana = await newUser(browser, "Ana");
  const groupId = await createGroup(ana.page, "🏠 Dorm 4B");
  await invite(ana.page, sam.email, "Sam");

  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  const dialog = ana.page.getByRole("dialog", { name: "New entry" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "🏠 Dorm 4B" })).toBeChecked();

  // An even split: the leftover cent goes to the payer.
  await dialog.getByLabel("What was it for?").fill("Electricity");
  await dialog.getByLabel("Amount", { exact: true }).fill("10.01");
  const preview = dialog.getByRole("list", { name: "Preview" });
  await expect(preview).toContainText("You (paid, +1¢ leftover)");
  await expect(preview).toContainText("$5.01");
  await expect(preview).toContainText("$5.00");

  // The page was loaded before Sam joined, so the form must have picked Sam up,
  // and must let the user change the split on this first open.
  await dialog.getByText("Custom amounts", { exact: true }).click();
  await expect(dialog.getByLabel("Sam's share")).toHaveValue("5.00");
  await dialog.getByText("Evenly", { exact: true }).click();
  await expect(dialog.getByLabel("Sam's share")).toBeHidden();
  await dialog.getByRole("button", { name: "Add expense" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    ana.page.getByText("Added Electricity ($10.01) to 🏠 Dorm 4B."),
  ).toBeVisible();
  let [saved] = await expensesOf(ana.page, groupId);
  expect(saved.amountCents).toBe(1001);
  expect(
    saved.shares.map((share) => share.shareCents).sort((a, b) => a - b),
  ).toEqual([500, 501]);
  expect(
    saved.shares.find((share) => share.userId === saved.payerId)?.shareCents,
  ).toBe(501);

  // Custom amounts: blocked until they add up.
  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  await dialog.getByLabel("What was it for?").fill("Dinner");
  await dialog.getByLabel("Amount", { exact: true }).fill("20");
  await dialog.getByText("Custom amounts", { exact: true }).click();
  await expect(dialog.getByLabel("Your share")).toHaveValue("10.00");
  await dialog.getByLabel("Sam's share").fill("15");
  await expect(
    dialog.getByText("The shares add up to $25.00, not $20.00."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Your share").fill("5");
  await expect(dialog.getByText(/The shares add up to/)).toBeHidden();
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();

  const all = await expensesOf(ana.page, groupId);
  expect(all.map((expense) => expense.description)).toEqual([
    "Dinner",
    "Electricity",
  ]);
  [saved] = all;
  expect(
    saved.shares.map((share) => share.shareCents).sort((a, b) => a - b),
  ).toEqual([500, 1500]);

  // The other member reads the same list but didn't pay for either.
  const seen = await expensesOf(sam.page, groupId);
  expect(seen).toHaveLength(2);
  expect(seen.every((expense) => expense.payerId === saved.payerId)).toBe(true);
});

test("the cost form shows mistakes next to their fields and closes with Escape", async ({
  page,
}) => {
  await register(page, "Jo", uniqueEmail("jo"));
  await createGroup(page, "✈️ Trip");

  const opener = page.getByRole("button", { name: /Log a cost/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "New entry" });
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(
    dialog.getByLabel("What was it for?"),
  ).toHaveAccessibleDescription("Enter what this cost was for.");
  await expect(
    dialog.getByLabel("Amount", { exact: true }),
  ).toHaveAccessibleDescription(/Enter an amount from \$0\.00/);

  await dialog.getByLabel("What was it for?").fill("Museum");
  await dialog.getByLabel("Amount", { exact: true }).fill("12");
  await dialog.getByLabel("Day").fill("2999-01-01");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog.getByLabel("Day")).toHaveAccessibleDescription(
    "The day can't be in the future.",
  );
  // The form stayed open: nothing was sent.
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
