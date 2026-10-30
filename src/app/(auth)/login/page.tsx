import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/validation/redirect";

export const metadata: Metadata = { title: "Log in · LifeBoard" };

// Reading ?next= and ?expired= blocks on the request. The page has no data,
// so a blocking render costs nothing worth a Suspense split.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next, expired } = await searchParams;
  return (
    <AuthShell title="Log in">
      <LoginForm next={safeNextPath(next)} expired={expired === "1"} />
    </AuthShell>
  );
}
