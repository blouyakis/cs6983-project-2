import { expect, test } from "@playwright/test";

// The API docs (#16) open without logging in, but the API they describe
// still needs a session.

test("the API docs open without a session and list the routes", async ({
  page,
}) => {
  await page.goto("/api/docs");
  await expect(page).toHaveURL("/api/docs");
  await expect(
    page.getByRole("heading", { level: 1, name: "LifeBoard API" }),
  ).toBeVisible();
  await expect(page.getByText("/api/auth/login").first()).toBeVisible();
  await expect(
    page.getByText("/api/groups/{groupId}/settlements").first(),
  ).toBeVisible();
});

test("trying GET /api/health from the docs gets an answer", async ({
  page,
}) => {
  await page.goto("/api/docs");
  const operation = page.locator("#operations-Health-getHealth");
  await operation.getByRole("button", { name: /\/api\/health/ }).click();
  await operation.getByRole("button", { name: "Try it out" }).click();
  await operation.getByRole("button", { name: "Execute" }).click();
  await expect(
    operation.locator(".live-responses-table .response-col_status"),
  ).toContainText(/200|503/);
});

test("a protected route still answers 401 without a session", async ({
  request,
}) => {
  const response = await request.get("/api/groups");
  expect(response.status()).toBe(401);
});
