import { expect, test, type Browser, type Page } from "@playwright/test";

// The overview (#10): user flow 1 lands here, and the net across groups is
// written in words. Needs the local database, like auth.spec.ts.

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
  await page.reload();
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

test("a new user lands on an overview with no groups and $0.00 spent", async ({
  page,
}) => {
  await register(page, "Ana", uniqueEmail("ana"));

  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: /across your groups/ }),
  ).toHaveText("You are all settled up across your groups.");
  await expect(main.getByText(/No shared groups yet/)).toBeVisible();
  const spending = main
    .getByRole("heading", { name: /Your spending/ })
    .locator("..");
  await expect(spending.getByText("$0.00")).toHaveCount(3);
  await expect(main.getByRole("article")).toHaveCount(0);
});

test("the overview nets the user's balances across groups, in words", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const jo = await newUser(browser, "Jo");

  // Sam pays $17.66 for both in the dorm: Ana owes $8.83.
  const dormUrl = await groupWith(ana.page, "🏠 Dorm 4B", sam.email);
  await logCost(sam.page, dormUrl, "17.66");
  // Ana pays $10.00 for both at the picnic: she is owed $5.00.
  const picnicUrl = await groupWith(ana.page, "🧺 Picnic", jo.email);
  await expect(memberRow(ana.page, "Jo")).toBeVisible();
  await logCost(ana.page, picnicUrl, "10.00");

  await ana.page.goto("/");
  const main = ana.page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: /across your groups/ }),
  ).toHaveText("You owe $3.83 across your groups.");
  await expect(
    main.getByText(/you owe \$8\.83 and are owed \$5\.00/),
  ).toBeVisible();

  const dorm = main.getByRole("article").filter({ hasText: "🏠 Dorm 4B" });
  await expect(dorm).toContainText("You owe $8.83");
  await expect(dorm).toContainText("your share $8.83");
  const picnic = main.getByRole("article").filter({ hasText: "🧺 Picnic" });
  await expect(picnic).toContainText("You are owed $5.00");
  await expect(main.getByText("$13.83", { exact: true }).first()).toBeVisible();

  // The sidebar and the Groups page show the same balances.
  const sidebar = ana.page.getByRole("list", { name: "Your groups" });
  await expect(sidebar).toContainText("You owe $8.83");
  await expect(sidebar).toContainText("You are owed $5.00");

  await dorm.getByRole("link", { name: /Open/ }).click();
  await expect(ana.page).toHaveURL(dormUrl);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the personal space is the first corner, and My list shows its open items", async ({
    page,
  }) => {
    await register(page, "Ana", uniqueEmail("ana"));

    const main = page.getByRole("main");
    await main.getByRole("button", { name: /Add a plan$/ }).click();
    const entry = page.getByRole("dialog", { name: "New entry" });
    await expect(entry.getByRole("radio", { name: "Plan it" })).toBeChecked();
    await entry.getByLabel("What is it?").fill("📮 Stamps");
    await entry.getByLabel("Estimated cost").fill("4.00");
    await entry.getByRole("button", { name: "Add to list" }).click();
    await expect(entry).toBeHidden();

    await expect(
      main.getByRole("heading", { name: "Your corners of life" }),
    ).toBeVisible();
    const corners = main
      .getByRole("heading", { name: "Your corners of life" })
      .locator("../..")
      .getByRole("listitem");
    await expect(corners.first()).toContainText("Just me");
    await expect(main.getByText("est. $4.00 open")).toBeVisible();
    await expect(main.getByText("Stamps", { exact: true })).toBeVisible();
  });
});
