import { describe, expect, it } from "vitest";
import { readListItemFields } from "./list-item-fields";

const blank = { title: "", quantityText: "", note: "", estimateText: "" };

describe("readListItemFields", () => {
  it("reads a title on its own as an item with no quantity, note or estimate", () => {
    expect(readListItemFields({ ...blank, title: "Milk" })).toEqual({
      ok: true,
      input: {
        title: "Milk",
        quantity: null,
        note: null,
        estimatedCents: null,
      },
    });
  });

  it("reads the estimate in dollars as whole cents, and the quantity", () => {
    expect(
      readListItemFields({
        title: "Milk",
        quantityText: "2",
        note: "Oat",
        estimateText: "$12.34",
      }),
    ).toEqual({
      ok: true,
      input: { title: "Milk", quantity: 2, note: "Oat", estimatedCents: 1234 },
    });
  });

  it("asks for a title", () => {
    expect(readListItemFields(blank)).toEqual({
      ok: false,
      errors: { title: "Enter what to do or buy." },
    });
  });

  it.each(["abc", "1.234", "-5"])(
    "asks for the estimate in dollars when it is %j",
    (estimateText) => {
      expect(
        readListItemFields({ ...blank, title: "Milk", estimateText }),
      ).toEqual({
        ok: false,
        errors: {
          estimatedCents: "Enter the estimate in dollars, such as 12.34.",
        },
      });
    },
  );

  it("rejects an estimate of $0, which is no estimate", () => {
    const result = readListItemFields({
      ...blank,
      title: "Milk",
      estimateText: "0",
    });

    expect(result.ok).toBe(false);
    expect(result.ok || Object.keys(result.errors)).toEqual(["estimatedCents"]);
  });

  it.each(["0", "1.5", "two", "-1"])(
    "rejects a quantity of %j",
    (quantityText) => {
      expect(
        readListItemFields({ ...blank, title: "Milk", quantityText }),
      ).toEqual({
        ok: false,
        errors: { quantity: "Enter a quantity of 1 or more, in whole units." },
      });
    },
  );

  it("reports every field with a problem at once", () => {
    const result = readListItemFields({
      title: "",
      quantityText: "0",
      note: "",
      estimateText: "abc",
    });

    expect(result.ok || Object.keys(result.errors).sort()).toEqual([
      "estimatedCents",
      "quantity",
      "title",
    ]);
  });
});
