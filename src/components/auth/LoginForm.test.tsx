import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("posts the credentials and goes to the page the user wanted", async () => {
    respond(200, { user: { id: "u1" } });
    render(<LoginForm next="/groups" expired={false} />);

    fillAndSubmit("sam@example.com", "correct horse");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/groups"));
    expect(router.refresh).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "sam@example.com",
        password: "correct horse",
      }),
    });
  });

  it("shows the server's generic message when the login fails", async () => {
    respond(401, {
      error: {
        code: "UNAUTHORIZED",
        message: "Email or password is incorrect.",
      },
    });
    render(<LoginForm next="/" expired={false} />);

    fillAndSubmit("sam@example.com", "wrong horse");

    const alert = await screen.findByText("Email or password is incorrect.");
    expect(alert).toHaveAttribute("aria-live", "polite");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows field errors next to their fields", async () => {
    respond(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { email: "Enter a valid email address." },
      },
    });
    render(<LoginForm next="/" expired={false} />);

    fillAndSubmit("nope", "x");

    await waitFor(() =>
      expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
        "Enter a valid email address.",
      ),
    );
  });

  it("says so when the request never reaches the server", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<LoginForm next="/" expired={false} />);

    fillAndSubmit("sam@example.com", "correct horse");

    expect(
      await screen.findByText("Something went wrong. Try again."),
    ).toBeInTheDocument();
  });

  it("tells the user their session expired", () => {
    render(<LoginForm next="/" expired />);
    expect(
      screen.getByText("Your session has expired. Please log in again."),
    ).toBeInTheDocument();
  });

  it("links to registration", () => {
    render(<LoginForm next="/" expired={false} />);
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/register");
  });
});
