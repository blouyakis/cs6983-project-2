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

  await ana.page.getByRole("link", { name: /Groups/ }).click();
  await expect(
    ana.page.getByRole("heading", { level: 1, name: /Your corners of life/ }),
  ).toBeVisible();
  await expect(ana.page.getByText("Shared · 0 groups")).toBeVisible();

  await ana.page.getByRole("button", { name: /New group/ }).click();
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

  await ana.page.getByLabel("Email").fill("nobody@example.com");
  await ana.page.getByRole("button", { name: "Invite" }).click();
  await expect(
    ana.page.getByText("No LifeBoard account uses that email."),
  ).toBeVisible();

  await ana.page.getByLabel("Email").fill(sam.email.toUpperCase());
  await ana.page.getByRole("button", { name: "Invite" }).click();
  await expect(ana.page.getByText("Sam joined the group.")).toBeVisible();
  await expect(
    ana.page.getByRole("listitem").filter({ hasText: "Sam" }),
  ).toBeVisible();

  await ana.page.getByLabel("Email").fill(sam.email);
  await ana.page.getByRole("button", { name: "Invite" }).click();
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

  const opener = page.getByRole("button", { name: /New group/ });
  await opener.click();
  await expect(page.getByRole("dialog", { name: "New group" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});
