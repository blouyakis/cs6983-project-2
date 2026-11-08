import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

// The accessibility pass (#18, AGENTS.md Section 8): every main page passes an
// automated WCAG 2.1 AA check at desktop and phone width, fits a 375px screen,
// and every form can be used with the keyboard alone with a visible focus
// style. Needs the local database, like auth.spec.ts.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 375, height: 812 },
];

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

// Creates a group and lands on its page. Returns the group's id.
async function createGroup(page: Page, name: string): Promise<string> {
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "New group" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
}

// Registers someone else in their own browser and invites them to the group
// on `page`, so the group has someone to pay (#14).
async function inviteSomeone(page: Page, browser: Browser, name: string) {
  const context = await browser.newContext();
  const other = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await other.goto("/register");
  await other.getByLabel("Name").fill(name);
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("correct horse");
  await other.getByRole("button", { name: "Create account" }).click();
  await expect(other).toHaveURL("/");
  await context.close();

  const invite = page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`${name} joined the group.`)).toBeVisible();
}

// Opens the Pay one person directly form on the group's settle-up page.
async function openPaymentForm(page: Page, groupId: string) {
  await page.goto(`/groups/${groupId}/settle-up`);
  await page.getByRole("button", { name: /^Pay/ }).click();
  const form = page.getByRole("dialog", { name: "Pay one person directly" });
  await expect(form).toBeVisible();
  return form;
}

// Gives the group a list item and a cost, so the pages have data to check.
async function fillGroup(page: Page) {
  await page
    .getByRole("main")
    .getByRole("button", { name: "Add to list" })
    .click();
  const plan = page.getByRole("dialog", { name: "New entry" });
  await plan.getByLabel("What is it?").fill("Paper towels");
  await plan.getByLabel("Estimated cost").fill("4.50");
  await plan.getByRole("button", { name: "Add to list" }).click();
  await expect(plan).toBeHidden();

  await page.getByRole("button", { name: /Log a cost/ }).click();
  const cost = page.getByRole("dialog", { name: "New entry" });
  await cost.getByLabel("What was it for?").fill("Electricity");
  await cost.getByLabel("Amount", { exact: true }).fill("30");
  await cost.getByRole("button", { name: "Add expense" }).click();
  await expect(cost).toBeHidden();
}

async function focusIsInside(page: Page, dialog: Locator) {
  const handle = await dialog.elementHandle();
  const inside = await page.evaluate(
    (element) => element !== null && element.contains(document.activeElement),
    handle,
  );
  expect(inside).toBe(true);
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  expect(
    violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

async function expectFitsTheScreen(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// The tab stops inside `scope`: every visible, enabled control, with a radio
// group counted once because arrow keys move inside it.
async function tabStopsIn(scope: Locator): Promise<number> {
  return scope.evaluate((root) => {
    const controls = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const stops = new Set<string>();
    controls.forEach((element, index) => {
      const radio = element as HTMLInputElement;
      stops.add(
        radio.type === "radio" ? `radio:${radio.name}` : `control:${index}`,
      );
    });
    return stops.size;
  });
}

// Presses Tab until focus leaves `scope` (or comes round again, in a dialog)
// and returns how many tab stops it reached and which never showed a focus
// style. A date field has several stops, so it counts as styled when any of
// them is.
async function tabThrough(page: Page) {
  const styledByStop = new Map<string, boolean>();
  for (let press = 0; press < 60; press += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLInputElement | null;
      if (!element) {
        return null;
      }
      const outlined = (target: Element | null) => {
        if (!target) {
          return false;
        }
        const style = getComputedStyle(target);
        return (
          (style.outlineStyle !== "none" &&
            parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== "none"
        );
      };
      return {
        key:
          element.type === "radio"
            ? `radio:${element.name}`
            : element.id || element.name || element.textContent || "",
        inside: element.closest("[data-tab-scope]") !== null,
        // A control hidden behind a styled label shows focus on that label.
        styled: outlined(element) || outlined(element.closest("label")),
      };
    });
    if (!stop || !stop.inside) {
      break;
    }
    if (
      styledByStop.has(stop.key) &&
      press > 0 &&
      stop.key === [...styledByStop.keys()][0]
    ) {
      break;
    }
    styledByStop.set(
      stop.key,
      (styledByStop.get(stop.key) ?? false) || stop.styled,
    );
  }
  return {
    reached: styledByStop.size,
    withoutFocusStyle: [...styledByStop]
      .filter(([, styled]) => !styled)
      .map(([key]) => key),
  };
}

for (const viewport of viewports) {
  test(`the signed-out pages pass the WCAG 2.1 AA check and fit the screen on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoViolations(page);
      await expectFitsTheScreen(page);
    }
  });

  test(`every signed-in page passes the WCAG 2.1 AA check and fits the screen on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Ada");
    const groupId = await createGroup(page, "🏠 Dorm 4B");
    await fillGroup(page);

    const paths = [
      "/",
      "/lists",
      "/groups",
      `/groups/${groupId}`,
      "/settle-up",
      `/groups/${groupId}/settle-up`,
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await expectNoViolations(page);
      await expectFitsTheScreen(page);
    }
  });

  test(`the dialogs pass the WCAG 2.1 AA check, trap focus and close with Escape on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Bo");
    await page.goto("/groups");
    await page
      .getByRole("main")
      .getByRole("button", { name: /New group/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "New group" });
    await expect(dialog).toBeVisible();
    await expectNoViolations(page);
    await expectFitsTheScreen(page);

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, dialog);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await createGroup(page, "🍕 Dinner");
    await page.getByRole("button", { name: /Log a cost/ }).click();
    const entry = page.getByRole("dialog", { name: "New entry" });
    await expect(entry).toBeVisible();
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 30; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, entry);
    }
    await page.keyboard.press("Escape");
    await expect(entry).toBeHidden();
  });

  test(`the payment dialog passes the WCAG 2.1 AA check, traps focus and closes with Escape on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Di");
    const groupId = await createGroup(page, "🏠 Dorm 4B");
    await inviteSomeone(page, browser, "Ed");

    const form = await openPaymentForm(page, groupId);
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, form);
    }
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
  });
}

test("tabbing through the login and register forms reaches every control with a visible focus style", async ({
  page,
}) => {
  for (const path of ["/login", "/register"]) {
    await page.goto(path);
    const form = page.getByRole("main").locator("form");
    await form.evaluate((element) =>
      element.setAttribute("data-tab-scope", ""),
    );
    const stops = await tabStopsIn(form);
    await page.locator("body").click({ position: { x: 0, y: 0 } });
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await form.getByLabel("Email").focus();
    // Shift+Tab to the first control, then walk forward through the form.
    await page.keyboard.press("Shift+Tab");
    if (path === "/register") {
      await expect(form.getByLabel("Name")).toBeFocused();
    }
    const { reached, withoutFocusStyle } = await tabThrough(page);
    expect(reached).toBeGreaterThanOrEqual(stops - 1);
    expect(withoutFocusStyle).toEqual([]);
  }
});

test("tabbing through the new group, new entry and edit forms reaches every control with a visible focus style", async ({
  page,
}) => {
  await register(page, "Cy");
  await page.goto("/groups");
  await page
    .getByRole("main")
    .getByRole("button", { name: /New group/ })
    .click();
  const groupForm = page.getByRole("dialog", { name: "New group" });
  await expect(groupForm).toBeVisible();
  await groupForm.evaluate((element) =>
    element.setAttribute("data-tab-scope", ""),
  );
  const groupStops = await tabStopsIn(groupForm);
  let result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(groupStops - 1);
  expect(result.withoutFocusStyle).toEqual([]);
  await page.keyboard.press("Escape");

  await createGroup(page, "🏠 Dorm 4B");
  await page.getByRole("button", { name: /Log a cost/ }).click();
  const entry = page.getByRole("dialog", { name: "New entry" });
  await expect(entry).toBeVisible();
  await entry.evaluate((element) => element.setAttribute("data-tab-scope", ""));
  const entryStops = await tabStopsIn(entry);
  result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(entryStops - 1);
  expect(result.withoutFocusStyle).toEqual([]);

  // The edit forms: Escape closes the entry form, then fill the group.
  await page.keyboard.press("Escape");
  await fillGroup(page);
  for (const [button, title] of [
    ["Edit Paper towels", "Edit item"],
    ["Edit Electricity", "Edit expense"],
  ]) {
    await page.getByRole("button", { name: button }).click();
    const edit = page.getByRole("dialog", { name: title });
    await expect(edit).toBeVisible();
    await edit.evaluate((element) =>
      element.setAttribute("data-tab-scope", ""),
    );
    const editStops = await tabStopsIn(edit);
    result = await tabThrough(page);
    expect(result.reached).toBeGreaterThanOrEqual(editStops - 1);
    expect(result.withoutFocusStyle).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(edit).toBeHidden();
  }
});

test("animations and transitions are switched off for prefers-reduced-motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");

  const longest = await page.evaluate(() => {
    const seconds = (list: string) =>
      Math.max(...list.split(",").map((value) => parseFloat(value) || 0));
    return Math.max(
      ...Array.from(document.querySelectorAll("*")).map((element) => {
        const style = getComputedStyle(element);
        return Math.max(
          seconds(style.transitionDuration),
          seconds(style.animationDuration),
        );
      }),
    );
  });
  expect(longest).toBeLessThan(0.001);
});

test("tabbing through the payment form reaches every control with a visible focus style", async ({
  page,
  browser,
}) => {
  await register(page, "Fay");
  const groupId = await createGroup(page, "🏠 Dorm 4B");
  await inviteSomeone(page, browser, "Gus");
  await inviteSomeone(page, browser, "Hal");

  const form = await openPaymentForm(page, groupId);
  await form.evaluate((element) => element.setAttribute("data-tab-scope", ""));
  const stops = await tabStopsIn(form);
  const result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(stops - 1);
  expect(result.withoutFocusStyle).toEqual([]);
});
