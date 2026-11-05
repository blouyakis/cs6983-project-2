import { expect, test, type Browser, type Page } from "@playwright/test";

// Balances (#9): after a cost is logged, the group page writes each member's
// balance in words, from each member's side. Needs the local database, like
// auth.spec.ts.

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

test("a logged cost shows who owes whom, in words, on both members' group pages", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");

  await ana.page.goto("/groups");
  // The sidebar has a New group button too (#53), so look inside the page.
  await ana.page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = ana.page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill("🏠 Dorm 4B");
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const groupUrl = ana.page.url();

  // Nothing logged yet: everyone is settled up.
  await expect(memberRow(ana.page, "Ana")).toContainText(
    "You are all settled up",
  );

  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();
  // The notice shows before the page refreshes, so wait for Sam to be in the
  // member list: the cost form takes its sharers from there.
  await expect(memberRow(ana.page, "Sam")).toBeVisible();

  // Ana pays $45.10 for both: Sam owes her half.
  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = ana.page.getByRole("dialog", { name: "New entry" });
  await entry.getByLabel("What was it for?").fill("Groceries");
  await entry.getByLabel("Amount", { exact: true }).fill("45.10");
  await entry.getByRole("button", { name: "Add expense" }).click();
  await expect(entry).toBeHidden();

  await ana.page.reload();
  await expect(memberRow(ana.page, "Ana")).toContainText("You are owed $22.55");
  await expect(memberRow(ana.page, "Sam")).toContainText("Sam owes $22.55");

  // Sam sees the same balances from his side.
  await sam.page.goto(groupUrl);
  await expect(memberRow(sam.page, "Sam")).toContainText("You owe $22.55");
  await expect(memberRow(sam.page, "Ana")).toContainText("Ana is owed $22.55");

  // And the API agrees, in cents, summing to zero.
  const response = await sam.page.request.get(
    `/api/groups/${groupUrl.split("/").pop()}/balances`,
  );
  expect(response.status()).toBe(200);
  const { balances } = await response.json();
  const cents = balances.map((b: { balanceCents: number }) => b.balanceCents);
  expect(cents.sort()).toEqual([-2255, 2255]);
});
