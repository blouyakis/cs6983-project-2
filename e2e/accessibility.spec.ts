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

// Registers someone else, invites them to the group on `page`, and keeps them
// signed in on a page of their own, for a step only another member can take:
// marking a settle-up payment paid, so a period of the bill closes (#21).
async function inviteAndStay(page: Page, browser: Browser, name: string) {
  const context = await browser.newContext();
  const other = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await other.goto("/register");
  await other.getByLabel("Name").fill(name);
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("correct horse");
  await other.getByRole("button", { name: "Create account" }).click();
  await expect(other).toHaveURL("/");

  const invite = page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`${name} joined the group.`)).toBeVisible();
  return { context, other };
}

// Registers someone else, invites them to the group on `page`, and has them
// record a direct payment to the owner of `page`, so `page` has a paid payment
// to decline (#108). Leaves `page` on the group page.
async function invitePayer(
  page: Page,
  browser: Browser,
  groupId: string,
  name: string,
) {
  const context = await browser.newContext();
  const other = await context.newPage();
  const email = uniqueEmail(name.toLowerCase());
  await other.goto("/register");
  await other.getByLabel("Name").fill(name);
  await other.getByLabel("Email").fill(email);
  await other.getByLabel("Password").fill("correct horse");
  await other.getByRole("button", { name: "Create account" }).click();
  await expect(other).toHaveURL("/");

  const invite = page.getByRole("form", { name: "Invite a member" });
  await invite.getByLabel("Email").fill(email);
  await invite.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`${name} joined the group.`)).toBeVisible();

  const form = await openPaymentForm(other, groupId);
  await form.getByLabel("Amount").fill("5");
  await form.getByRole("button", { name: "Record payment" }).click();
  await expect(form).toBeHidden();
  await context.close();
  await page.goto(`/groups/${groupId}`);
}

// Opens the Default split form on the group's page (#63) on Custom
// percentages, so every field is there.
async function openDefaultSplitForm(page: Page) {
  await page.getByRole("button", { name: "Change the default split" }).click();
  const form = page.getByRole("dialog", { name: "Default split" });
  await expect(form).toBeVisible();
  await form.getByText("Custom percentages").click();
  await expect(form.getByRole("textbox").first()).toBeVisible();
  return form;
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

// Opens the check-off form for the list item fillGroup adds (#12), with the
// actual cost filled in, so the split under it is there to check.
async function openCheckOffForm(page: Page) {
  await page.getByRole("checkbox", { name: "Check off Paper towels" }).click();
  const form = page.getByRole("dialog", { name: "Check off Paper towels" });
  await expect(form).toBeVisible();
  await form.getByLabel("Actual cost").fill("4.50");
  return form;
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

// AGENTS.md Section 8: headings in order. axe's heading-order rule is a best
// practice, not a WCAG tag, so expectNoViolations doesn't run it (#16).
async function expectHeadingsInOrder(page: Page) {
  const skips = await page.evaluate(() => {
    const levels = Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
    )
      .filter((heading) => heading.checkVisibility())
      .map((heading) => ({
        level: Number(heading.tagName[1]),
        text: (heading.textContent ?? "").trim().slice(0, 40),
      }));
    return levels
      .filter((heading, index) =>
        index === 0
          ? heading.level !== 1
          : heading.level > levels[index - 1].level + 1,
      )
      .map((heading) => `h${heading.level} ${heading.text}`);
  });
  expect(skips).toEqual([]);
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

  // Swagger UI draws the routes in the browser after the page loads, so the
  // check waits for them. It opens a route of each method, with its Try it
  // out form, and runs GET /api/health so a live response is on the page too
  // (#16).
  test(`the API docs pass the WCAG 2.1 AA check and fit the screen on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/api/docs");
    for (const id of [
      "Auth-login",
      "Groups-getGroup",
      "Groups-updateGroup",
      "Expenses-deleteExpense",
      "Health-getHealth",
    ]) {
      const operation = page.locator(`#operations-${id}`);
      await operation.locator(".opblock-summary-control").click();
      await operation.getByRole("button", { name: "Try it out" }).click();
    }
    const health = page.locator("#operations-Health-getHealth");
    await health.getByRole("button", { name: "Execute" }).click();
    await expect(health.locator(".live-responses-table")).toBeVisible();
    // Execute is disabled at opacity 0.3 while the request runs and fades
    // back over 0.3s; checking contrast mid-fade would measure a colour
    // nobody reads.
    await expect(health.getByRole("button", { name: "Execute" })).toHaveCSS(
      "opacity",
      "1",
    );
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    await expectHeadingsInOrder(page);
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

  test(`the decline dialog passes the WCAG 2.1 AA check, traps focus and closes with Escape on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Fay");
    const groupId = await createGroup(page, "🏠 Dorm 4B");
    await invitePayer(page, browser, groupId, "Gus");

    const opener = page.getByRole("button", { name: /I didn't get it/ });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Didn't get $5.00 from Gus?");
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, dialog);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test(`the Moving out card and its Leave dialog pass the WCAG 2.1 AA check, trap focus and close with Escape on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Fay");
    await createGroup(page, "🏠 Dorm 4B");
    await inviteSomeone(page, browser, "Gus");
    // The notice shows before the page refreshes, and the cost form takes its
    // sharers from the member list, so wait for Gus to be in it.
    await expect(
      page
        .getByRole("heading", { name: /^Members/ })
        .locator("..")
        .getByRole("listitem")
        .filter({ hasText: "Gus" }),
    ).toBeVisible();
    const card = page.getByRole("region", { name: "Moving out?" });

    // With a balance: Leave group is off, the reason is written out, and
    // Settle my $X first is shown (#22).
    await page.getByRole("button", { name: /Log a cost/ }).click();
    const cost = page.getByRole("dialog", { name: "New entry" });
    await cost.getByLabel("What was it for?").fill("Electricity");
    await cost.getByLabel("Amount", { exact: true }).fill("30");
    await cost.getByRole("button", { name: "Add expense" }).click();
    await expect(cost).toBeHidden();
    await expect(card).toContainText("You are owed $15.00 in this group.");
    await expect(card.getByRole("link", { name: /Settle my/ })).toBeVisible();
    await expectNoViolations(page);
    await expectFitsTheScreen(page);

    // At zero, Leave group opens the confirm dialog.
    await page.goto("/groups");
    await createGroup(page, "🍕 Dinner");
    await inviteSomeone(page, browser, "Hal");
    await card.getByRole("button", { name: "Leave group" }).click();
    const dialog = page.getByRole("dialog", { name: /^Leave 🍕 Dinner\?/ });
    await expect(dialog).toBeVisible();
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 6; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, dialog);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
}

for (const viewport of viewports) {
  test(`the default split dialog passes the WCAG 2.1 AA check, traps focus and closes with Escape on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Ivy");
    await createGroup(page, "🏠 Dorm 4B");
    await inviteSomeone(page, browser, "Jay");

    const form = await openDefaultSplitForm(page);
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, form);
    }
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
  });

  // The check-off form (#12): the actual cost and, in a group, who shares it.
  test(`the check-off form passes the WCAG 2.1 AA check, traps focus and closes with Escape on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Mia");
    await createGroup(page, "🏠 Dorm 4B");
    await inviteSomeone(page, browser, "Ned");
    await fillGroup(page);

    const form = await openCheckOffForm(page);
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      await focusIsInside(page, form);
    }
    await page.keyboard.press("Escape");
    await expect(form).toBeHidden();
  });

  // A past period of the bill (#21). /groups/{groupId}?period=… only exists
  // once a settle-up has closed, so the signed-in pages check above, which
  // scans the group page, only ever sees the current period.
  test(`a past period of the bill passes the WCAG 2.1 AA check and fits the screen on ${viewport.name}`, async ({
    page,
    browser,
  }) => {
    await page.setViewportSize(viewport);
    await register(page, "Oda");
    const groupId = await createGroup(page, "🏠 Dorm 4B");
    const { context, other } = await inviteAndStay(page, browser, "Pip");
    await fillGroup(page);

    // The period closes: Oda starts a settle-up, Pip pays, Oda confirms.
    const started = await page.request.post(
      `/api/groups/${groupId}/settlements`,
    );
    expect(started.status()).toBe(201);
    const [payment] = (await started.json()).settleUp.payments;
    const paid = await other.request.post(
      `/api/groups/${groupId}/payments/${payment.id}/paid`,
    );
    expect(paid.status()).toBe(200);
    const confirmed = await page.request.post(
      `/api/groups/${groupId}/payments/${payment.id}/confirm`,
    );
    expect(confirmed.status()).toBe(200);
    await context.close();

    await page.goto(`/groups/${groupId}`);
    const bill = page.getByRole("region", { name: /Your bill/ });
    const periods = bill.getByRole("navigation", { name: "Bill period" });
    await periods.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/\?period=[0-9a-f-]{36}#bill$/);
    await expect(bill).toContainText("This period is closed");
    await expectNoViolations(page);
    await expectFitsTheScreen(page);
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

// The expense filters on the overview (#15). The table under them is on "/",
// which the signed-in pages check above already loads with a cost in it.
test("tabbing through the expense filters reaches every control with a visible focus style", async ({
  page,
}) => {
  await page.setViewportSize(viewports[0]);
  await register(page, "Eve");
  await createGroup(page, "🏠 Dorm 4B");
  await fillGroup(page);
  await page.goto("/");

  const form = page.getByRole("form", { name: "Filter expenses" });
  await expect(form).toBeVisible();
  await form.evaluate((element) => element.setAttribute("data-tab-scope", ""));
  const stops = await tabStopsIn(form);
  await form.getByLabel("Group", { exact: true }).focus();
  // Shift+Tab steps out of the form, so the walk starts on its first control.
  await page.keyboard.press("Shift+Tab");
  const { reached, withoutFocusStyle } = await tabThrough(page);
  expect(reached).toBeGreaterThanOrEqual(stops - 1);
  expect(withoutFocusStyle).toEqual([]);
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

test("tabbing through the default split form reaches every control with a visible focus style", async ({
  page,
  browser,
}) => {
  await register(page, "Kit");
  await createGroup(page, "🏠 Dorm 4B");
  await inviteSomeone(page, browser, "Lou");

  const form = await openDefaultSplitForm(page);
  await form.evaluate((element) => element.setAttribute("data-tab-scope", ""));
  const stops = await tabStopsIn(form);
  const result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(stops - 1);
  expect(result.withoutFocusStyle).toEqual([]);
});

test("tabbing through the check-off form reaches every control with a visible focus style", async ({
  page,
  browser,
}) => {
  await register(page, "Quin");
  await createGroup(page, "🏠 Dorm 4B");
  await inviteSomeone(page, browser, "Rae");
  await fillGroup(page);

  const form = await openCheckOffForm(page);
  await form.evaluate((element) => element.setAttribute("data-tab-scope", ""));
  const stops = await tabStopsIn(form);
  const result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(stops - 1);
  expect(result.withoutFocusStyle).toEqual([]);
});

test("tabbing through the API docs' Try it out form reaches every control with a visible focus style", async ({
  page,
}) => {
  await page.goto("/api/docs");
  const operation = page.locator("#operations-Auth-login");
  const opener = operation.locator(".opblock-summary-control");
  await opener.click();
  await operation.getByRole("button", { name: "Try it out" }).click();
  await expect(
    operation.getByRole("textbox", { name: "Request body" }),
  ).toBeVisible();
  await operation.evaluate((element) =>
    element.setAttribute("data-tab-scope", ""),
  );
  const stops = await tabStopsIn(operation);
  await opener.focus();
  const result = await tabThrough(page);
  expect(result.reached).toBeGreaterThanOrEqual(stops - 1);
  expect(result.withoutFocusStyle).toEqual([]);
});

// Swagger UI's "Copy path to clipboard" button is 0px wide until the mouse
// hovers its row, so a keyboard user tabbed onto a control they couldn't see
// (#16, manual testing). Every control Tab reaches must have a size.
test("every control Tab reaches on the API docs can be seen", async ({
  page,
}) => {
  await page.goto("/api/docs");
  await page
    .locator("#operations-Auth-register .opblock-summary-control")
    .focus();
  const hidden = new Set<string>();
  for (let press = 0; press < 30; press += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) {
        return null;
      }
      const box = element.getBoundingClientRect();
      return {
        name:
          element.getAttribute("aria-label") ??
          (element.textContent ?? "").trim().slice(0, 40),
        seen: box.width > 0 && box.height > 0,
      };
    });
    if (stop && !stop.seen) {
      hidden.add(stop.name);
    }
  }
  expect([...hidden]).toEqual([]);
});
