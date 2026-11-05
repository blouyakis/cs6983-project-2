import { expect, test, type Browser, type Page } from "@playwright/test";

// The planning half of user flow 2 (AGENTS.md Section 5, #11): add items to a
// group list, see the open total, and edit or delete an open item. Checking
// one off is #12. Needs the local database, like groups.spec.ts.

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

async function createGroup(page: Page, name: string): Promise<void> {
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
}

async function addToList(page: Page, title: string, estimate = "") {
  await page
    .getByRole("main")
    .getByRole("button", { name: "Add to list" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New entry" });
  await expect(dialog.getByRole("radio", { name: "Plan it" })).toBeChecked();
  await dialog.getByLabel("What is it?").fill(title);
  await dialog.getByLabel("Estimated cost").fill(estimate);
  await dialog.getByRole("button", { name: "Add to list" }).click();
  await expect(dialog).toBeHidden();
}

// The ListStats card is a <dl>, and its one amount is the open total.
function stillToBuy(page: Page) {
  return page.getByRole("main").getByRole("definition");
}

function list(page: Page) {
  return page.getByRole("region", { name: "To do & buy" }).getByRole("list");
}

test("add items to a group list, see what is still to buy, then edit and delete one", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  const groupUrl = ana.page.url();
  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();

  await addToList(ana.page, "🧻 Paper towels", "12");
  await addToList(ana.page, "Dish soap", "3.50");
  await addToList(ana.page, "Take out recycling");

  await expect(stillToBuy(ana.page)).toHaveText("$15.50");
  await expect(ana.page.getByText("3 open")).toBeVisible();
  await expect(list(ana.page).getByRole("listitem").first()).toContainText(
    "Take out recycling",
  );
  await expect(list(ana.page)).toContainText("added by You · no cost");

  // Sam sees the same list, with Ana's name on her items, and can edit one.
  await sam.page.goto(groupUrl);
  await expect(list(sam.page)).toContainText("added by Ana · est. $12.00");
  await sam.page.getByRole("button", { name: "Edit Dish soap" }).click();
  const edit = sam.page.getByRole("dialog", { name: "Edit item" });
  await edit.getByLabel("Estimated cost").fill("5");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(stillToBuy(sam.page)).toHaveText("$17.00");

  // An estimate of $0 is rejected next to its field.
  await sam.page.getByRole("button", { name: "Edit Dish soap" }).click();
  await edit.getByLabel("Estimated cost").fill("0");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit.getByLabel("Estimated cost")).toHaveAccessibleDescription(
    /Enter an estimate from \$0\.01/,
  );
  await edit.getByRole("button", { name: "Cancel" }).click();

  await sam.page.getByRole("button", { name: "Delete Paper towels" }).click();
  await expect(
    sam.page.getByRole("status").filter({ hasText: "Deleted" }),
  ).toHaveText("Deleted Paper towels.");
  await expect(list(sam.page)).not.toContainText("Paper towels");
  await expect(sam.page.getByText("2 open")).toBeVisible();
  await expect(stillToBuy(sam.page)).toHaveText("$5.00");
});

test("the personal space has its own list", async ({ browser }) => {
  const ana = await newUser(browser, "Ana");
  await ana.page.goto("/groups");
  await ana.page
    .getByRole("main")
    .getByRole("link", { name: /Personal space/ })
    .first()
    .click();
  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  await addToList(ana.page, "💇 Haircut", "35");

  await expect(ana.page.getByText("Planned")).toBeVisible();
  await expect(list(ana.page)).toContainText("Haircut");
  await expect(list(ana.page)).toContainText(
    /Added \w{3} \d+ · est\. \$35\.00/,
  );
});

// The form body scrolls in a fixed-height column, so a Toggle that may shrink
// is squashed to its borders once the cost form is taller than the dialog.
test("the Plan it / Already spent switch keeps its height in both modes", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  const dialog = ana.page.getByRole("dialog", { name: "New entry" });
  const toggle = dialog.getByRole("radiogroup", { name: "Kind of entry" });

  await ana.page.getByRole("button", { name: /Log a cost/ }).click();
  expect((await toggle.boundingBox())?.height).toBeGreaterThan(30);
  await dialog.getByText("Plan it", { exact: true }).click();
  expect((await toggle.boundingBox())?.height).toBeGreaterThan(30);
  await dialog.getByText("Already spent", { exact: true }).click();
  expect((await toggle.boundingBox())?.height).toBeGreaterThan(30);
});
