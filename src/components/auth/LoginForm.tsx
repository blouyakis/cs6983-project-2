"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/http/errors";
import { postJson } from "@/lib/http/api-client";

const EXPIRED_MESSAGE = "Your session has expired. Please log in again.";

export function LoginForm({
  next,
  expired,
}: {
  next: string;
  expired: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState(expired ? EXPIRED_MESSAGE : "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await postJson("/api/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
    });
    if (result.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setPending(false);
    setFieldErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? "" : result.error.message);
  }

  return (
    // method="post": until the page's script has loaded, the browser submits
    // the form itself, and its default, GET, would put the password in the
    // URL. A POST renders the page again with the empty form (#142).
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <p aria-live="polite" className="text-owe empty:hidden">
        {formError}
      </p>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={fieldErrors.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
      />
      <PrimaryButton type="submit" disabled={pending}>
        Log in
      </PrimaryButton>
      <p className="text-sm">
        New to LifeBoard?{" "}
        <Link href="/register" className="font-semibold underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
