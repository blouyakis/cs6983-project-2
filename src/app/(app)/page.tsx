import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SignedInAs } from "@/components/auth/SignedInAs";

export default function OverviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Overview</h1>
        <LogoutButton />
      </header>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SignedInAs />
      </Suspense>
      {/* TODO(#23): show the personal space and groups here. */}
    </main>
  );
}
