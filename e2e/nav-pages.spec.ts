import { expect, test, type Page } from "@playwright/test";

// The Lists and Settle up pages (#68). Needs the local database, like
// auth.spec.ts.

function uniqueEmail(name: string) {
  return `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, name: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(uniqueEmail(name.toLowerCase()));
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
}

async function createGroup(page: Page, name: string) {
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

test("a visitor without a session is sent to login from both pages", async ({
  page,
}) => {
  await page.goto("/lists");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/settle-up");
  await expect(page).toHaveURL(/\/login/);
});

test("a user with only a personal space sees it on Lists and nothing to settle", async ({
  page,
}) => {
  await register(page, "Lena");

  await page.goto("/lists");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lists" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /Personal space/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Create one" }),
  ).toHaveAttribute("href", "/groups");

  await page.goto("/settle-up");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settle up" }),
  ).toBeVisible();
  await expect(page.getByText("There is nothing to settle.")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Create a group" }),
  ).toHaveAttribute("href", "/groups");
});

test("a new group appears on both pages and links to its list and settle-up screen", async ({
  page,
}) => {
  await register(page, "Max");
  await createGroup(page, "🏠 Dorm 4B");

  await page.goto("/lists");
  const listLink = page
    .getByRole("main")
    .getByRole("link", { name: /Dorm 4B/ });
  await expect(listLink).toContainText("Nothing open on the list");
  await listLink.click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  await page.goto("/settle-up");
  const settleLink = page
    .getByRole("main")
    .getByRole("link", { name: /Dorm 4B/ });
  await expect(settleLink).toContainText("You are all settled up");
  await settleLink.click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}\/settle-up$/);
});
