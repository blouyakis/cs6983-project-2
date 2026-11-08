import { expect, test, type Browser, type Page } from "@playwright/test";

// Pay one person directly (#14, user flow 6): a member records a payment to
// another member from the settle-up page, the recipient confirms it on the
// group page, and both balances move. Needs the local database, like
// settle-up.spec.ts.

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

function memberRow(page: Page, name: string) {
  return page
    .getByRole("heading", { name: /^Members/ })
    .locator("..")
    .getByRole("listitem")
    .filter({ hasText: name });
}

function paymentRows(page: Page) {
  return page
    .getByRole("heading", { name: "Payments", exact: true })
    .locator("..")
    .getByRole("listitem");
}

// Ana creates a group and invites Sam. Returns the group's id.
async function groupOfTwo(ana: { page: Page }, sam: { email: string }) {
  await ana.page.goto("/groups");
  await ana.page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = ana.page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill("🏠 Dorm 4B");
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(ana.page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  const invite = ana.page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(sam.email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(memberRow(ana.page, "Sam")).toBeVisible();
  return ana.page.url().split("/").pop() as string;
}

test("pay one person directly, and the balances move once the recipient confirms", async ({
  browser,
}) => {
  const ana = await newUser(browser, "Ana");
  const sam = await newUser(browser, "Sam");
  const groupId = await groupOfTwo(ana, sam);

  // Ana records $8.83 to Sam from the settle-up page.
  await ana.page.goto(`/groups/${groupId}/settle-up`);
  await ana.page.getByRole("button", { name: /^Pay/ }).click();
  const form = ana.page.getByRole("dialog", {
    name: "Pay one person directly",
  });
  // Sam is the only other member, so he is already chosen.
  await expect(form.getByRole("radio", { name: "Sam" })).toBeChecked();
  await form.getByLabel("Amount").fill("8.83");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form).toBeHidden();
  await expect(ana.page.getByRole("status")).toHaveText(
    "Recorded $8.83 to Sam. It counts once Sam confirms it.",
  );

  // Nothing moves until Sam confirms.
  await ana.page.goto(`/groups/${groupId}`);
  await expect(paymentRows(ana.page)).toHaveCount(1);
  await expect(paymentRows(ana.page).first()).toContainText(
    "Marked paid · waiting for Sam to confirm",
  );
  await expect(paymentRows(ana.page).first().getByRole("button")).toHaveCount(
    0,
  );
  await expect(memberRow(ana.page, "Sam")).toContainText("settled up");

  // Sam confirms it on the group page.
  await sam.page.goto(`/groups/${groupId}`);
  const samRow = paymentRows(sam.page).first();
  await expect(samRow).toContainText("Ana → You");
  await expect(samRow).toContainText("$8.83");
  await samRow.getByRole("button", { name: /I got it/ }).click();
  await expect(sam.page.getByRole("status")).toHaveText(
    "Confirmed $8.83 from Ana. Balances are updated.",
  );
  await expect(paymentRows(sam.page).first()).toContainText("Confirmed · done");

  // Ana is now owed $8.83 and Sam owes it (AGENTS.md Section 6.4).
  await ana.page.reload();
  await expect(memberRow(ana.page, "Sam")).toContainText("$8.83");
  await expect(memberRow(ana.page, "Sam")).toContainText(/owes/);

  // Confirming again is a conflict, and Ana can't confirm her own payment.
  const listed = await ana.page.request.get(`/api/groups/${groupId}/payments`);
  const [payment] = (await listed.json()).payments;
  const again = await sam.page.request.post(
    `/api/groups/${groupId}/payments/${payment.id}/confirm`,
  );
  expect(again.status()).toBe(409);
  const byAna = await ana.page.request.post(
    `/api/groups/${groupId}/payments/${payment.id}/confirm`,
  );
  expect(byAna.status()).toBe(403);
});
