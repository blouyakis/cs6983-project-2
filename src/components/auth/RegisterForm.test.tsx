import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "./RegisterForm";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

function fillAndSubmit(password = "correct horse") {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Sam Lee" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "sam@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterForm", () => {
  it("creates the account and lands on the overview", async () => {
    respond(201, { user: { id: "u1" } });
    render(<RegisterForm />);

    fillAndSubmit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(router.refresh).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sam Lee",
        email: "sam@example.com",
        password: "correct horse",
      }),
    });
  });

  it("tells the user the password rule before they submit", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "At least 8 characters.",
    );
  });

  it("shows a short-password error under the password field", async () => {
    respond(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { password: "Password must be at least 8 characters." },
      },
    });
    render(<RegisterForm />);

    fillAndSubmit("short");

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
        "At least 8 characters. Password must be at least 8 characters.",
      ),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a duplicate-email error under the email field", async () => {
    respond(409, {
      error: {
        code: "CONFLICT",
        message: "An account with this email already exists.",
      },
    });
    render(<RegisterForm />);

    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
        "An account with this email already exists.",
      ),
    );
  });

  it("links to login", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
