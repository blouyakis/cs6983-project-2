import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoticeProvider, useNotice } from "./NoticeProvider";

// A button that posts a notice, and the status region that shows it.
function Poster({ source, text }: { source: string; text: string }) {
  const { notice, show } = useNotice(source);
  return (
    <div>
      <button type="button" onClick={() => show(text, "done")}>
        Post from {source}
      </button>
      <button type="button" onClick={() => show(`${text} failed`, "problem")}>
        Fail from {source}
      </button>
      <p role="status" aria-label={source} data-tone={notice?.tone}>
        {notice?.text}
      </p>
    </div>
  );
}

function region(source: string) {
  return screen.getByRole("status", { name: source });
}

describe("NoticeProvider", () => {
  it("shows a notice where it was posted", () => {
    render(
      <NoticeProvider>
        <Poster source="costs" text="Added Electricity." />
        <Poster source="list" text="Deleted Milk." />
      </NoticeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post from costs" }));

    expect(region("costs")).toHaveTextContent("Added Electricity.");
    expect(region("list")).toBeEmptyDOMElement();
  });

  it("clears the last notice elsewhere on the page when a new one is posted", () => {
    render(
      <NoticeProvider>
        <Poster source="costs" text="Added Sponges." />
        <Poster source="list" text="Deleted Sponges." />
      </NoticeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post from costs" }));
    fireEvent.click(screen.getByRole("button", { name: "Post from list" }));

    expect(region("costs")).toBeEmptyDOMElement();
    expect(region("list")).toHaveTextContent("Deleted Sponges.");
  });

  it("says whether it is news or a problem", () => {
    render(
      <NoticeProvider>
        <Poster source="list" text="Deleted Milk." />
      </NoticeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post from list" }));
    expect(region("list")).toHaveAttribute("data-tone", "done");

    fireEvent.click(screen.getByRole("button", { name: "Fail from list" }));
    expect(region("list")).toHaveAttribute("data-tone", "problem");
  });

  it("clears its own notice", () => {
    function Clearer() {
      const { notice, show, clear } = useNotice("list");
      return (
        <div>
          <button type="button" onClick={() => show("Deleted Milk.", "done")}>
            Post
          </button>
          <button type="button" onClick={clear}>
            Clear
          </button>
          <p role="status">{notice?.text}</p>
        </div>
      );
    }
    render(
      <NoticeProvider>
        <Clearer />
      </NoticeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps a notice to itself when there is no provider", () => {
    render(
      <>
        <Poster source="costs" text="Added Sponges." />
        <Poster source="list" text="Deleted Sponges." />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post from costs" }));
    fireEvent.click(screen.getByRole("button", { name: "Post from list" }));

    expect(region("costs")).toHaveTextContent("Added Sponges.");
    expect(region("list")).toHaveTextContent("Deleted Sponges.");
  });
});
