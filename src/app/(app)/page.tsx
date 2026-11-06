import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SignedInAs } from "@/components/auth/SignedInAs";
import { OverviewBoard } from "@/components/overview/OverviewBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OverviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <PageHeader title="Overview">
        <LogoutButton />
      </PageHeader>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SignedInAs />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Loading your overview…</p>}>
        <OverviewBoard />
      </Suspense>
    </main>
  );
}
