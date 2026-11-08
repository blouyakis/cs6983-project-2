import { expect, test, type Browser, type Page } from "@playwright/test";

// The sidebar's groups stay current on client navigation (#89): the (app)
// layout isn't rendered again then, so the sidebar asks the server itself.
// Needs the local database, like auth.spec.ts.

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

// Creates a group, invites `inviteeEmail`, and returns the group's URL.
async function groupWith(page: Page, name: string, inviteeEmail: string) {
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const invite = page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(inviteeEmail);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(/joined the group\./)).toBeVisible();
  return page.url();
}

async function logCost(page: Page, groupUrl: string, amount: string) {
  await page.goto(groupUrl);
  await page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = page.getByRole("dialog", { name: "New entry" });
  await entry.getByLabel("What was it for?").fill("Groceries");
  await entry.getByLabel("Amount", { exact: true }).fill(amount);
  await entry.getByRole("button", { name: "Add expense" }).click();
  await expect(entry).toBeHidden();
}

function navLink(page: Page, name: string | RegExp) {
  return page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name });
}

test("after a link, the sidebar shows what another member changed", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const dormUrl = await groupWith(sam.page, "🏠 Dorm 4B", ana.email);

  await ana.page.goto("/");
  const sidebar = ana.page.getByRole("list", { name: "Your groups" });
  const dorm = sidebar.getByRole("link", { name: /🏠 Dorm 4B/ });
  await expect(dorm).toContainText("You are all settled up");

  // Sam pays $17.66 for both: Ana owes $8.83. He also adds her to a new group.
  await logCost(sam.page, dormUrl, "17.66");
  await groupWith(sam.page, "🧺 Picnic", ana.email);

  // Ana's sidebar was rendered before either change, and a link doesn't
  // render the layout again.
  await navLink(ana.page, "Groups").click();
  await expect(ana.page).toHaveURL("/groups");
  await expect(
    ana.page.getByRole("main").getByRole("article").filter({
      hasText: "🏠 Dorm 4B",
    }),
  ).toContainText("You owe $8.83");
  await expect(dorm).toContainText("You owe $8.83");
  await expect(sidebar.getByRole("link", { name: /🧺 Picnic/ })).toBeVisible();
});

test("if the sidebar's groups can't be loaded, it still lists them without balances", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  await groupWith(sam.page, "🏠 Dorm 4B", ana.email);

  await ana.page.goto("/");
  const sidebar = ana.page.getByRole("list", { name: "Your groups" });
  const dorm = sidebar.getByRole("link", { name: /🏠 Dorm 4B/ });
  await expect(dorm).toContainText("You are all settled up");

  await ana.page.route("**/api/sidebar-groups", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
      }),
    }),
  );
  await navLink(ana.page, "Groups").click();

  // The page keeps working, and the sidebar drops the balances it can no
  // longer vouch for.
  await expect(ana.page).toHaveURL("/groups");
  await expect(
    ana.page.getByRole("main").getByRole("article").filter({
      hasText: "🏠 Dorm 4B",
    }),
  ).toBeVisible();
  await expect(dorm).toHaveText("🏠 Dorm 4B");
  await expect(
    sidebar.getByRole("link", { name: "Personal space" }),
  ).toBeVisible();
});
