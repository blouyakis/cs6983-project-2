import { expect, test, type Page } from "@playwright/test";

// Needs the local database: npx supabase start, plus SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET in the environment.

function uniqueEmail() {
  return `sam-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Sam Lee");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("a signed-out visitor is sent to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("register, log out, and log back in", async ({ page, context }) => {
  const email = uniqueEmail();

  await register(page, email, "correct horse");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Signed in as Sam Lee")).toBeVisible();

  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");
  expect(
    (await context.cookies()).find((c) => c.name === "session"),
  ).toBeUndefined();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);

  await logIn(page, email.toUpperCase(), "correct horse");
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in as Sam Lee")).toBeVisible();
});

test("registration rejects a short password and a taken email", async ({
  page,
}) => {
  const email = uniqueEmail();

  await register(page, email, "short");
  await expect(
    page.getByText("Password must be at least 8 characters.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("/register");

  await register(page, email, "correct horse");
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");

  await register(page, email, "correct horse");
  await expect(
    page.getByText("An account with this email already exists."),
  ).toBeVisible();
});

test("a wrong password gets the generic message", async ({ page }) => {
  await page.goto("/login");
  await logIn(page, uniqueEmail(), "wrong horse");
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("an invalid session cookie is sent to login as expired", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "session", value: "not-a-jwt", url: "http://localhost:3000" },
  ]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?.*expired=1/);
  await expect(
    page.getByText("Your session has expired. Please log in again."),
  ).toBeVisible();
});

test("the API answers 401 without a valid session", async ({ request }) => {
  const response = await request.get("/api/auth/me", {
    headers: { cookie: "session=not-a-jwt" },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe("UNAUTHORIZED");
});
