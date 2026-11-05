import { expect, test, type Page } from "@playwright/test";

// The app shell (#53): the sidebar on desktop and the tab bar on a phone
// link every signed-in page, mark the current one, and work by keyboard.
// Needs the local database, like auth.spec.ts.

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

test("the sidebar marks the current page and moves between pages by keyboard", async ({
  page,
}) => {
  await register(page, "Sam");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Groups" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  // Not built yet, so they are not links (#68).
  await expect(nav.getByRole("link", { name: /Lists/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Settle up/ })).toHaveCount(0);

  await nav.getByRole("link", { name: "Groups" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/groups");
  await expect(nav.getByRole("link", { name: "Groups" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("a group the user creates appears in the sidebar and is marked when open", async ({
  page,
}) => {
  await register(page, "Ana");
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill("🏠 Dorm 4B");
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

  const groups = page.getByRole("list", { name: "Your groups" });
  await expect(
    groups.getByRole("link", { name: "🏠 Dorm 4B" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", {
      name: "Groups",
    }),
  ).toHaveAttribute("aria-current", "page");
});

test("a phone gets the tab bar instead of the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, "Jo");

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  await expect(nav).toHaveCSS("position", "fixed");
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("button", { name: /New group/ })).toHaveCount(0);

  await nav.getByRole("link", { name: "Groups" }).click();
  await expect(page).toHaveURL("/groups");
  await expect(nav.getByRole("link", { name: "Groups" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
