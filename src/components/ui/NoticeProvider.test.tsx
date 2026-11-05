import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoticeLine, NoticeProvider, useNotice } from "./NoticeProvider";

// A part of the page that posts notices, such as the list or Log a cost.
function Poster({ name, text }: { name: string; text: string }) {
  const { show, clear } = useNotice();
  return (
    <div>
      <button type="button" onClick={() => show(text, "done")}>
        Post from {name}
      </button>
      <button type="button" onClick={() => show(`${text} failed`, "problem")}>
        Fail from {name}
      </button>
      <button type="button" onClick={clear}>
        Clear from {name}
      </button>
    </div>
  );
}

function page() {
  return render(
    <NoticeProvider>
      <Poster name="costs" text="Added Sponges." />
      <NoticeLine />
      <Poster name="list" text="Deleted Sponges." />
    </NoticeProvider>,
  );
}

describe("NoticeProvider", () => {
  it("shows every notice in the one place on the page", () => {
    page();

    expect(screen.getAllByRole("status")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Post from costs" }));
    expect(screen.getByRole("status")).toHaveTextContent("Added Sponges.");

    fireEvent.click(screen.getByRole("button", { name: "Post from list" }));
    expect(screen.getByRole("status")).toHaveTextContent("Deleted Sponges.");
  });

  it("writes news in green and a problem in the owe color", () => {
    page();

    fireEvent.click(screen.getByRole("button", { name: "Post from list" }));
    expect(screen.getByRole("status")).toHaveClass("text-action");

    fireEvent.click(screen.getByRole("button", { name: "Fail from list" }));
    expect(screen.getByRole("status")).toHaveClass("text-owe");
    expect(screen.getByRole("status")).not.toHaveClass("text-action");
  });

  it("clears the notice, whoever posted it", () => {
    page();

    fireEvent.click(screen.getByRole("button", { name: "Post from costs" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear from list" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("can't be used outside a provider, so no notice is lost", () => {
    // React logs the error it rethrows; keep the test output clean.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Poster name="costs" text="Added Sponges." />)).toThrow(
      "useNotice needs a NoticeProvider",
    );
    quiet.mockRestore();
  });
});
