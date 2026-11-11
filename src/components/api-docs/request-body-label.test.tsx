import { render, screen } from "@testing-library/react";
import type { TextareaHTMLAttributes } from "react";
import { describe, expect, it } from "vitest";
import { requestBodyLabel } from "./request-body-label";

// Swagger UI's own TextArea is a bare <textarea {...props} />.
function SwaggerTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

const TextArea = requestBodyLabel.wrapComponents.TextArea(SwaggerTextArea);

describe("requestBodyLabel", () => {
  it("names the Try it out request body box", () => {
    render(<TextArea className="body-param__text" />);
    expect(
      screen.getByRole("textbox", { name: "Request body" }),
    ).toBeInTheDocument();
  });

  it("keeps the request body box's other props", () => {
    render(<TextArea className="body-param__text invalid" defaultValue="{}" />);
    const box = screen.getByRole("textbox", { name: "Request body" });
    expect(box).toHaveClass("body-param__text", "invalid");
    expect(box).toHaveValue("{}");
  });

  it("leaves a textarea that already has a name alone", () => {
    render(<TextArea className="body-param__text" aria-label="Tags" />);
    expect(screen.getByRole("textbox", { name: "Tags" })).toBeInTheDocument();
  });

  it("doesn't name other textareas", () => {
    render(<TextArea className="something-else" />);
    expect(screen.getByRole("textbox")).not.toHaveAccessibleName();
  });
});
