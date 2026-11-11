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
  await operation.getByRole("button", { name: /^GET \/api\/health/ }).click();
  await operation.getByRole("button", { name: "Try it out" }).click();
  await operation.getByRole("button", { name: "Execute" }).click();
  await expect(
    operation.locator(".live-responses-table tbody .response-col_status"),
  ).toContainText(/200|503/);
});

// openapi.yaml's info tells readers to log in with Try it out on
// POST /api/auth/login before trying the other routes; this is that path.
test("logging in from the docs lets Try it out reach a protected route", async ({
  page,
  request,
}) => {
  // `request` keeps its cookies apart from `page`, so the page starts signed
  // out.
  const email = `docs-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const registered = await request.post("/api/auth/register", {
    data: { name: "Docs Reader", email, password: "correct horse" },
  });
  expect(registered.status()).toBe(201);

  await page.goto("/api/docs");
  const login = page.locator("#operations-Auth-login");
  await login.locator(".opblock-summary-control").click();
  await login.getByRole("button", { name: "Try it out" }).click();
  await login
    .getByRole("textbox", { name: "Request body" })
    .fill(JSON.stringify({ email, password: "correct horse" }));
  await login.getByRole("button", { name: "Execute" }).click();
  await expect(
    login.locator(".live-responses-table tbody .response-col_status"),
  ).toHaveText("200");

  const me = page.locator("#operations-Auth-getCurrentUser");
  await me.locator(".opblock-summary-control").click();
  await me.getByRole("button", { name: "Try it out" }).click();
  await me.getByRole("button", { name: "Execute" }).click();
  await expect(
    me.locator(".live-responses-table tbody .response-col_status"),
  ).toHaveText("200");
});

// The responses tables fit a phone without squeezing the Code and Links
// columns until "Code" or "401" breaks into one letter per line (#16).
for (const width of [1280, 375]) {
  test(`the response codes stay on one line at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/api/docs");
    const me = page.locator("#operations-Auth-getCurrentUser");
    await me.locator(".opblock-summary-control").click();
    await me.getByRole("button", { name: "Try it out" }).click();
    await me.getByRole("button", { name: "Execute" }).click();
    await expect(me.locator(".live-responses-table")).toBeVisible();
    const wrapped = await me.evaluate((operation) =>
      Array.from(
        operation.querySelectorAll<HTMLElement>(
          ".responses-table .response-col_status, .responses-table .response-col_links",
        ),
      )
        .filter((cell) => cell.textContent?.trim())
        .filter((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const tops = new Set(
            Array.from(range.getClientRects()).map((rect) =>
              Math.round(rect.top),
            ),
          );
          return tops.size > 1;
        })
        .map((cell) => cell.textContent?.trim()),
    );
    expect(wrapped).toEqual([]);
  });
}

test("a protected route still answers 401 without a session", async ({
  request,
}) => {
  const response = await request.get("/api/groups");
  expect(response.status()).toBe(401);
});
