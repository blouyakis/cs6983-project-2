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
  await sam.page
    .getByRole("dialog", {
      name: "Delete Paper towels? It comes off the list for everyone.",
    })
    .getByRole("button", { name: "Delete" })
    .click();
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

// User flow 2, the buying half (#12): checking an item off with a cost logs an
// expense split among the sharers and moves the balances. Unchecking it, once
// confirmed, reopens the item, deletes the expense and puts the balances back.
function memberRow(page: Page, name: string) {
  return page
    .getByRole("heading", { name: /^Members/ })
    .locator("..")
    .getByRole("listitem")
    .filter({ hasText: name });
}

test("check off an item with a cost and split, then uncheck it", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();

  await addToList(ana.page, "🛒 Groceries", "50");
  await list(ana.page)
    .getByRole("checkbox", { name: "Check off Groceries" })
    .click();
  const checkOff = ana.page.getByRole("dialog", {
    name: "Check off Groceries",
  });
  await checkOff.getByLabel("Actual cost").fill("47.99");
  // Shared by everyone, evenly, unless Ana changes it.
  await checkOff.getByRole("button", { name: "Check off" }).click();
  await expect(checkOff).toBeHidden();

  await expect(
    ana.page.getByText("Checked off Groceries for $47.99."),
  ).toBeVisible();
  const row = list(ana.page)
    .getByRole("listitem")
    .filter({ hasText: "Groceries" });
  await expect(
    row.getByRole("checkbox", { name: "Uncheck Groceries" }),
  ).toBeChecked();
  await expect(row).toContainText("✔ You paid $47.99");
  // $47.99 between two: Sam's half is $23.99, and the leftover cent is Ana's.
  await expect(memberRow(ana.page, "Sam")).toContainText("Sam owes $23.99");

  await row.getByRole("checkbox", { name: "Uncheck Groceries" }).click();
  const confirm = ana.page.getByRole("dialog", {
    name: "Uncheck Groceries? This deletes its $47.99 expense.",
  });
  await confirm.getByRole("button", { name: "Uncheck and delete" }).click();
  await expect(confirm).toBeHidden();

  await expect(
    ana.page.getByText("Unchecked Groceries and deleted its $47.99 expense."),
  ).toBeVisible();
  await expect(
    row.getByRole("checkbox", { name: "Check off Groceries" }),
  ).not.toBeChecked();
  await expect(memberRow(ana.page, "Sam")).toContainText(
    "Sam is all settled up",
  );

  // Sam can't uncheck what Ana checked off.
  await list(ana.page)
    .getByRole("checkbox", { name: "Check off Groceries" })
    .click();
  await ana.page
    .getByRole("dialog", { name: "Check off Groceries" })
    .getByRole("button", { name: "Check off" })
    .click();
  await sam.page.goto(ana.page.url());
  await expect(
    list(sam.page).getByRole("checkbox", { name: "Groceries is done" }),
  ).toBeDisabled();
});

// With no cost, the item is only marked done: no expense, nothing to split.
test("check off an item with no cost", async ({ browser }) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");

  await addToList(ana.page, "Take out recycling");
  await list(ana.page)
    .getByRole("checkbox", { name: "Check off Take out recycling" })
    .click();
  const checkOff = ana.page.getByRole("dialog", {
    name: "Check off Take out recycling",
  });
  await checkOff.getByRole("button", { name: "Check off" }).click();
  await expect(checkOff).toBeHidden();

  await expect(
    list(ana.page).getByRole("checkbox", {
      name: "Uncheck Take out recycling",
    }),
  ).toBeChecked();
  await expect(
    ana.page.getByText("Checked off Take out recycling."),
  ).toBeVisible();
});

// In the personal space, checking off logs a personal expense with no split
// (#12, #23).
test("check off a personal item and see it logged as a personal expense", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  await ana.page.goto("/groups");
  await ana.page
    .getByRole("main")
    .getByRole("link", { name: /Personal space/ })
    .first()
    .click();
  await addToList(ana.page, "💇 Haircut", "35");

  await list(ana.page)
    .getByRole("checkbox", { name: "Check off Haircut" })
    .click();
  const checkOff = ana.page.getByRole("dialog", { name: "Check off Haircut" });
  await expect(checkOff.getByText("How is it split?")).toHaveCount(0);
  await checkOff.getByLabel("Actual cost").fill("32");
  await checkOff.getByRole("button", { name: "Check off" }).click();

  const row = list(ana.page).getByRole("listitem").filter({
    hasText: "Haircut",
  });
  await expect(row).toContainText("Logged as personal expense", {
    ignoreCase: true,
  });
  await expect(ana.page.getByText("Spent this month")).toBeVisible();
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

// A modal dialog makes the page behind it inert, but Chrome still hands the
// wheel to that page once the form can't scroll, so the page's scrollbar moved
// while the form stood still.
test("scrolling over an open form leaves the page behind it where it was", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  // Short enough that the group page scrolls.
  await ana.page.setViewportSize({ width: 900, height: 500 });

  await ana.page
    .getByRole("main")
    .getByRole("button", { name: "Add to list" })
    .click();
  const dialog = ana.page.getByRole("dialog", { name: "New entry" });
  await expect(dialog).toBeVisible();
  const before = await ana.page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  const box = await dialog.boundingBox();
  await ana.page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await ana.page.mouse.wheel(0, -2000);
  await ana.page.mouse.wheel(0, 2000);
  await ana.page.waitForTimeout(300);

  expect(await ana.page.evaluate(() => window.scrollY)).toBe(before);
});

// Planning from Log a cost and then deleting from the list used to leave
// "Added Sponges…" in green under Log a cost, while "Deleted Sponges." sat in
// plain text under the list.
test("the page keeps only the latest notice", async ({ browser }) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  const main = ana.page.getByRole("main");

  await main.getByRole("button", { name: /Log a cost/ }).click();
  const dialog = ana.page.getByRole("dialog", { name: "New entry" });
  await dialog.getByText("Plan it", { exact: true }).click();
  await dialog.getByLabel("What is it?").fill("Sponges");
  await dialog.getByRole("button", { name: "Add to list" }).click();
  await expect(
    main.getByText("Added Sponges to 🏠 Dorm 4B's list."),
  ).toBeVisible();

  await main.getByRole("button", { name: "Delete Sponges" }).click();
  await ana.page
    .getByRole("dialog", {
      name: "Delete Sponges? It comes off the list for everyone.",
    })
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(main.getByText("Deleted Sponges.")).toBeVisible();
  await expect(
    main.getByText("Added Sponges to 🏠 Dorm 4B's list."),
  ).toHaveCount(0);

  // One place for every notice, whichever button was used: right above the
  // STILL TO BUY card, below Log a cost.
  const notices = main.getByRole("status");
  await expect(notices).toHaveCount(1);
  const notice = await notices.boundingBox();
  const stats = await main.getByText("Still to buy").boundingBox();
  const logCost = await main
    .getByRole("button", { name: /Log a cost/ })
    .boundingBox();
  expect(notice!.y).toBeLessThan(stats!.y);
  expect(notice!.y).toBeGreaterThan(logCost!.y);
});

// Radio groups are one Tab stop, and the arrow keys choose within them. The
// Plan it / Already spent switch shared its radio name with the split editor's
// Evenly / Custom amounts, so the browser made the four options one group.
test("the Plan it / Already spent switch works with the keyboard alone", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "🏠 Dorm 4B");
  const page = ana.page;
  await page
    .getByRole("main")
    .getByRole("button", { name: "Add to list" })
    .focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New entry" });
  const planIt = dialog.getByRole("radio", { name: "Plan it" });
  const spent = dialog.getByRole("radio", { name: "Already spent" });
  await expect(planIt).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(spent).toBeFocused();
  await expect(spent).toBeChecked();
  await expect(dialog.getByLabel("Day")).toBeVisible();

  // Tab leaves the switch, and Shift+Tab comes back to the chosen option.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(spent).toBeFocused();
  await expect(spent).toBeChecked();

  await page.keyboard.press("ArrowLeft");
  await expect(planIt).toBeChecked();
  await expect(dialog.getByLabel("What is it?")).toBeVisible();
});

// The list is shared, so Delete asks first (#76). Everything here is done
// with the keyboard: Cancel has focus when the dialog opens, so Enter alone
// never deletes, and focus lands on the list heading once the row is gone.
test("delete a list item with the keyboard, confirming in the dialog", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  await createGroup(ana.page, "Flat 2");
  await addToList(ana.page, "Sponges", "3");
  await addToList(ana.page, "Bin bags");
  const page = ana.page;
  const confirm = page.getByRole("dialog", {
    name: "Delete Sponges? It comes off the list for everyone.",
  });

  await page.getByRole("button", { name: "Delete Sponges" }).focus();
  await page.keyboard.press("Enter");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();

  // Escape keeps the item, and focus goes back to its Delete button.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(list(page)).toContainText("Sponges");
  await expect(
    page.getByRole("button", { name: "Delete Sponges" }),
  ).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm.getByRole("button", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("status").filter({ hasText: "Deleted" }),
  ).toHaveText("Deleted Sponges.");
  await expect(confirm).toBeHidden();
  await expect(list(page)).not.toContainText("Sponges");
  await expect(list(page)).toContainText("Bin bags");
  await expect(
    page.getByRole("heading", { name: "To do & buy" }),
  ).toBeFocused();
});
