import { expect, test, type Browser, type Page } from "@playwright/test";

// User flow 1 (AGENTS.md Section 5): register, land on the overview, create a
// group and invite a member by email. Needs the local database, like
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

test("create a group, invite a member by email, and both see it", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const ana = await newUser(browser, "Ana");

  // The sidebar's Groups link; the overview has no link of its own (#53).
  await ana.page.getByRole("link", { name: "Groups" }).click();
  await expect(
    ana.page.getByRole("heading", { level: 1, name: /Your corners of life/ }),
  ).toBeVisible();
  await expect(ana.page.getByText("Shared · 0 groups")).toBeVisible();

  await ana.page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = ana.page.getByRole("dialog", { name: "New group" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name")).toBeFocused();
  await dialog.getByLabel("Name").fill("🏠 Dorm 4B");
  await dialog.getByRole("button", { name: "Create group" }).click();

  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await expect(
    ana.page.getByRole("heading", { level: 1, name: "🏠 Dorm 4B" }),
  ).toBeVisible();
  await expect(ana.page.getByText("Ana (you)")).toBeVisible();

  // Next keeps the register page mounted but hidden after navigating, with
  // its own Email field, so look inside the invite form.
  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill("nobody@example.com");
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(
    ana.page.getByText("No LifeBoard account uses that email."),
  ).toBeVisible();

  await invite.getByLabel("Email").fill(sam.email.toUpperCase());
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();
  await expect(
    // The bill has a line for Sam too (#21), so look in the member list.
    ana.page
      .getByRole("heading", { name: /^Members/ })
      .locator("..")
      .getByRole("listitem")
      .filter({ hasText: "Sam" }),
  ).toBeVisible();

  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(
    ana.page.getByText("They are already in this group."),
  ).toBeVisible();

  await sam.page.goto("/groups");
  await expect(sam.page.getByText("Shared · 1 group")).toBeVisible();
  await expect(sam.page.getByText("You, Ana · even split")).toBeVisible();
});

test("the new group form closes with Escape and returns focus", async ({
  page,
}) => {
  await register(page, "Jo", uniqueEmail("jo"));
  await page.goto("/groups");

  // The sidebar has a New group button too, so look inside the page.
  const opener = page
    .getByRole("main")
    .getByRole("button", { name: /New group/ });
  await opener.click();
  await expect(page.getByRole("dialog", { name: "New group" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});

// US-3 (#63): set a group's default split on the group page, then invite a
// third member, which resets an uneven split to even.
test("set a 60/40 default split, and inviting a third member resets it to even", async ({
  browser,
}) => {
  const sam = await newUser(browser, "Sam");
  const jo = await newUser(browser, "Jo");
  const ana = await newUser(browser, "Ana");

  await ana.page.goto("/groups");
  await ana.page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const create = ana.page.getByRole("dialog", { name: "New group" });
  await create.getByLabel("Name").fill("🏠 Flat");
  await create.getByRole("button", { name: "Create group" }).click();
  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();
  await expect(
    ana.page.getByText("Default split: even split", { exact: true }),
  ).toBeVisible();

  const opener = ana.page.getByRole("button", {
    name: "Change the default split",
  });
  await opener.click();
  const form = ana.page.getByRole("dialog", { name: "Default split" });
  await expect(form.getByRole("radio", { name: "Evenly" })).toBeChecked();
  await form.getByText("Custom percentages").click();
  await form.getByLabel("Ana (%)").fill("60");
  await form.getByLabel("Sam (%)").fill("30");
  await form.getByRole("button", { name: "Save split" }).click();
  await expect(
    form.getByText("The percentages add up to 90%. Make them add up to 100%."),
  ).toBeVisible();

  await form.getByLabel("Sam (%)").fill("40");
  await form.getByRole("button", { name: "Save split" }).click();
  await expect(form).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(
    ana.page.getByText("Default split: 60/40 default", { exact: true }),
  ).toBeVisible();

  // The form opens on the ratio it saved.
  await opener.click();
  await expect(
    form.getByRole("radio", { name: "Custom percentages" }),
  ).toBeChecked();
  await expect(form.getByLabel("Ana (%)")).toHaveValue("60");
  await ana.page.keyboard.press("Escape");
  await expect(form).toBeHidden();

  await invite.getByLabel("Email").fill(jo.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(
    ana.page.getByText(
      "Jo joined the group. The default split is now even, because 60/40 was set for 2 people.",
    ),
  ).toBeVisible();
  await expect(
    ana.page.getByText("Default split: even split", { exact: true }),
  ).toBeVisible();

  await ana.page.getByRole("button", { name: "Set a new split" }).click();
  await expect(form).toBeVisible();
  await expect(form.getByRole("radio", { name: "Evenly" })).toBeChecked();
});
