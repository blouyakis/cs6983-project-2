"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email")),
      password: String(form.get("password")),
    };
    const name = String(form.get("name") ?? "").trim();
    if (isRegister && name) payload.name = name;

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">
        {isRegister ? "Create account" : "Log in"}
      </h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {isRegister && (
          <label className="flex flex-col gap-1">
            Name
            <input
              name="name"
              type="text"
              autoComplete="name"
              className="rounded border px-3 py-2"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="rounded border px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {isRegister ? "Register" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
