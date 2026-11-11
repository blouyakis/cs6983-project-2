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

async function logCost(
  page: Page,
  groupUrl: string,
  amount: string,
  description = "Groceries",
) {
  await page.goto(groupUrl);
  await page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = page.getByRole("dialog", { name: "New entry" });
  await entry.getByLabel("What was it for?").fill(description);
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

// The expense history (#15, user story 1): every expense the user shares,
// across their groups, with filters that live in the address.
test("the expense history lists what the user shares and filters it by group, payer and day", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const jo = await newUser(browser, "Jo");

  // Sam pays $17.66 for both in the dorm; Ana pays $10.00 for both at the picnic.
  const dormUrl = await groupWith(ana.page, "🏠 Dorm 4B", sam.email);
  await logCost(sam.page, dormUrl, "17.66", "Groceries");
  const picnicUrl = await groupWith(ana.page, "🧺 Picnic", jo.email);
  await expect(memberRow(ana.page, "Jo")).toBeVisible();
  await logCost(ana.page, picnicUrl, "10.00", "Snacks");

  await ana.page.goto("/");
  const history = ana.page.getByRole("region", { name: /Your expenses/ });
  const filters = history.getByRole("form", { name: "Filter expenses" });
  const rows = history.getByRole("rowheader");
  const rowOf = (description: string) =>
    history.getByRole("row").filter({ hasText: description });

  // Both costs, each with its group, who paid, the total and Ana's share.
  await expect(rows).toHaveCount(2);
  await expect(history.getByText("2 expenses match.")).toBeVisible();
  await expect(rowOf("Groceries")).toContainText("🏠 Dorm 4B");
  await expect(rowOf("Groceries")).toContainText("Sam");
  await expect(rowOf("Groceries")).toContainText("$17.66");
  await expect(rowOf("Groceries")).toContainText("$8.83");
  await expect(rowOf("Snacks")).toContainText("🧺 Picnic");
  await expect(rowOf("Snacks")).toContainText("You");
  await expect(rowOf("Snacks")).toContainText("$5.00");

  // The pencil is only on the cost Ana paid; Sam's has a lock, in words.
  await expect(history.getByRole("button", { name: /^Edit / })).toHaveCount(1);
  await expect(rowOf("Groceries")).toContainText("Only Sam can edit this");
  await rowOf("Snacks").getByRole("button", { name: "Edit Snacks" }).click();
  const edit = ana.page.getByRole("dialog", { name: "Edit expense" });
  await expect(edit).toBeVisible();
  await ana.page.keyboard.press("Escape");
  await expect(edit).toBeHidden();

  // Paid by Sam: the filter goes in the address and one expense is left.
  await filters.getByLabel("Paid by", { exact: true }).selectOption({
    label: "Sam",
  });
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(ana.page).toHaveURL(/paidBy=[0-9a-f-]{36}/);
  await expect(
    history.getByText("1 expense matches these filters."),
  ).toBeVisible();
  await expect(rows).toHaveText(["Groceries"]);
  await expect(filters.getByLabel("Paid by", { exact: true })).not.toHaveValue(
    "",
  );

  // Clear filters brings both back.
  await filters.getByRole("link", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(2);

  // By group.
  await filters.getByLabel("Group", { exact: true }).selectOption({
    label: "🧺 Picnic",
  });
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(rows).toHaveText(["Snacks"]);

  // By day: nothing was spent from 2099 on, and From after To is refused
  // next to the field.
  await filters.getByRole("link", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(2);
  await filters.getByLabel("From", { exact: true }).fill("2099-01-01");
  await filters.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    history.getByText("No expenses match these filters."),
  ).toBeVisible();
  await expect(history.getByRole("table")).toHaveCount(0);
  await ana.page.goto("/?from=2026-11-02&to=2026-11-01");
  await expect(history.getByText("To can't be before From.")).toBeVisible();
  await expect(history.getByRole("table")).toHaveCount(0);

  // The API gives the same list, and the same refusals.
  const all = await ana.page.request.get("/api/expenses");
  expect(all.status()).toBe(200);
  const { expenses } = await all.json();
  expect(
    expenses.map((expense: { description: string }) => expense.description),
  ).toEqual(expect.arrayContaining(["Groceries", "Snacks"]));
  expect(expenses).toHaveLength(2);
  const backwards = await ana.page.request.get(
    "/api/expenses?from=2026-11-02&to=2026-11-01",
  );
  expect(backwards.status()).toBe(400);
  const notMine = await ana.page.request.get(
    "/api/expenses?groupId=4e5f6a7b-2222-4333-8444-a55566667777",
  );
  expect(notMine.status()).toBe(403);

  // Jo is only in the picnic, so the dorm's cost never shows for her.
  await jo.page.goto("/");
  const josRows = jo.page
    .getByRole("region", { name: /Your expenses/ })
    .getByRole("rowheader");
  await expect(josRows).toHaveText(["Snacks"]);
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
