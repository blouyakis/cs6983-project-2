"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import type { FieldErrors } from "@/lib/http/errors";
import { postJson } from "@/lib/http/api-client";

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await postJson("/api/auth/register", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (result.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    if (result.error.code === "CONFLICT") {
      setFieldErrors({ email: result.error.message });
      setFormError("");
      return;
    }
    setFieldErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? "" : result.error.message);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p aria-live="polite" className="text-owe empty:hidden">
        {formError}
      </p>
      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        required
        error={fieldErrors.name}
      />
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
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        error={fieldErrors.password}
      />
      <PrimaryButton type="submit" disabled={pending}>
        Create account
      </PrimaryButton>
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
