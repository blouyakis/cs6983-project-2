import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create your account · LifeBoard" };

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account">
      <RegisterForm />
    </AuthShell>
  );
}
