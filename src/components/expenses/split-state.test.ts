// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/db/group-members";
import {
  amountTexts,
  chooseMode,
  chooseSharers,
  initialSplitState,
  resolveSplit,
  typeAmount,
} from "./split-state";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "8b3e4f60-1111-4222-8333-944455556666";

function people(weights: [number, number, number] = [1, 1, 1]): Member[] {
  return [
    { userId: ana, name: "Ana", defaultShareWeight: weights[0] },
    { userId: sam, name: "Sam", defaultShareWeight: weights[1] },
    { userId: jo, name: "Jo", defaultShareWeight: weights[2] },
  ];
}

// A 60/40 group of two, which opens on Custom amounts.
const sixtyForty: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 3 },
  { userId: sam, name: "Sam", defaultShareWeight: 2 },
];

describe("initialSplitState", () => {
  it("opens on Evenly with everyone sharing when every weight is the same", () => {
    expect(initialSplitState(people())).toEqual({
      mode: "even",
      sharedBy: [ana, sam, jo],
      typed: null,
    });
  });

  it("opens on Custom amounts when the weights differ", () => {
    expect(initialSplitState(sixtyForty)).toEqual({
      mode: "custom",
      sharedBy: [ana, sam],
      typed: null,
    });
  });
});

describe("amountTexts", () => {
  it("fills custom amounts in from the group's weights", () => {
    const state = initialSplitState(sixtyForty);

    expect(amountTexts(state, sixtyForty, ana, 1000)).toEqual({
      [ana]: "6.00",
      [sam]: "4.00",
    });
  });

  it("puts a leftover cent on the payer", () => {
    const state = initialSplitState(sixtyForty);

    expect(amountTexts(state, sixtyForty, ana, 1001)).toEqual({
      [ana]: "6.01",
      [sam]: "4.00",
    });
    expect(amountTexts(state, sixtyForty, sam, 1001)).toEqual({
      [ana]: "6.00",
      [sam]: "4.01",
    });
  });

  it("fills them in again when the amount changes and nothing was typed", () => {
    const state = initialSplitState(sixtyForty);

    expect(amountTexts(state, sixtyForty, ana, 0)).toEqual({
      [ana]: "0.00",
      [sam]: "0.00",
    });
    expect(amountTexts(state, sixtyForty, ana, 2000)).toEqual({
      [ana]: "12.00",
      [sam]: "8.00",
    });
  });

  it("treats an amount that isn't a number yet as 0", () => {
    const state = initialSplitState(sixtyForty);

    expect(amountTexts(state, sixtyForty, ana, null)).toEqual({
      [ana]: "0.00",
      [sam]: "0.00",
    });
  });

  it("uses only the weights of the people sharing", () => {
    const three = people([3, 2, 5]);
    const state = chooseSharers(initialSplitState(three), [ana, jo]);

    expect(amountTexts(state, three, ana, 800)).toEqual({
      [ana]: "3.00",
      [jo]: "5.00",
    });
  });

  it("leaves what the user typed alone once they have edited one", () => {
    const start = initialSplitState(sixtyForty);
    const edited = typeAmount(start, sixtyForty, ana, 1000, sam, "5");

    expect(amountTexts(edited, sixtyForty, ana, 1000)).toEqual({
      [ana]: "6.00",
      [sam]: "5",
    });
    expect(amountTexts(edited, sixtyForty, ana, 9999)).toEqual({
      [ana]: "6.00",
      [sam]: "5",
    });
  });

  it("starts someone who joins the sharers after an edit with an empty field", () => {
    const three = people([3, 2, 5]);
    const narrowed = chooseSharers(initialSplitState(three), [ana, sam]);
    const edited = typeAmount(narrowed, three, ana, 1000, sam, "4");
    const widened = chooseSharers(edited, [ana, sam, jo]);

    expect(amountTexts(widened, three, ana, 1000)).toEqual({
      [ana]: "6.00",
      [sam]: "4",
      [jo]: "",
    });
  });
});

describe("typeAmount", () => {
  it("keeps the amounts as they were shown, except the one edited", () => {
    const start = initialSplitState(sixtyForty);

    const next = typeAmount(start, sixtyForty, ana, 1001, sam, "3.5");

    expect(next.typed).toEqual({ [ana]: "6.01", [sam]: "3.5" });
    expect(next.mode).toBe("custom");
  });
});

describe("chooseMode and chooseSharers", () => {
  it("switch the mode without losing what was typed", () => {
    const start = initialSplitState(sixtyForty);
    const edited = typeAmount(start, sixtyForty, ana, 1000, sam, "5");

    const there = chooseMode(chooseMode(edited, "even"), "custom");

    expect(there.typed).toEqual({ [ana]: "6.00", [sam]: "5" });
  });

  it("replace who shares", () => {
    const state = chooseSharers(initialSplitState(people()), [ana, sam]);

    expect(state.sharedBy).toEqual([ana, sam]);
  });
});

describe("resolveSplit", () => {
  it("splits evenly 1:1 with the leftover on the payer, whatever the weights", () => {
    const state = chooseMode(initialSplitState(sixtyForty), "even");

    expect(resolveSplit(state, sixtyForty, ana, 1001)).toEqual({
      fields: { mode: "even", sharedBy: [ana, sam] },
      shares: [
        { userId: ana, shareCents: 501 },
        { userId: sam, shareCents: 500 },
      ],
    });
  });

  it("reads the custom amounts as cents", () => {
    const state = typeAmount(
      initialSplitState(sixtyForty),
      sixtyForty,
      ana,
      1000,
      sam,
      "4.00",
    );

    expect(resolveSplit(state, sixtyForty, ana, 1000)).toEqual({
      fields: {
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 600, [sam]: 400 },
      },
      shares: [
        { userId: ana, shareCents: 600 },
        { userId: sam, shareCents: 400 },
      ],
    });
  });

  it("accepts custom amounts of 0 when the amount is 0", () => {
    const state = initialSplitState(sixtyForty);

    const resolved = resolveSplit(state, sixtyForty, ana, 0);

    expect(resolved).toMatchObject({
      fields: { amountsCents: { [ana]: 0, [sam]: 0 } },
    });
  });

  it("blocks custom amounts that don't add up, in the domain's words", () => {
    const state = typeAmount(
      initialSplitState(sixtyForty),
      sixtyForty,
      ana,
      1000,
      sam,
      "3",
    );

    expect(resolveSplit(state, sixtyForty, ana, 1000)).toEqual({
      fieldErrors: { amountsCents: "The shares add up to $9.00, not $10.00." },
    });
  });

  it.each(["", "abc", "1.234"])(
    "blocks a custom amount typed as %j",
    (text) => {
      const state = typeAmount(
        initialSplitState(sixtyForty),
        sixtyForty,
        ana,
        1000,
        sam,
        text,
      );

      expect(resolveSplit(state, sixtyForty, ana, 1000)).toEqual({
        fieldErrors: {
          amountsCents:
            "Enter every share in dollars and cents, such as 12.34.",
        },
      });
    },
  );

  it("reports a payer who isn't sharing under sharedBy", () => {
    const state = chooseSharers(initialSplitState(people()), [sam, jo]);

    expect(resolveSplit(state, people(), ana, 1000)).toEqual({
      fieldErrors: {
        sharedBy: "The payer must be one of the people sharing this cost.",
      },
    });
  });

  it("reports an amount the domain refuses under amountCents", () => {
    const state = initialSplitState(people());

    expect(resolveSplit(state, people(), ana, 2_147_483_648)).toEqual({
      fieldErrors: {
        amountCents: expect.stringContaining("Enter an amount"),
      },
    });
  });
});
