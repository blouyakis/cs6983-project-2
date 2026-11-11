import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { SearchParams } from "@/components/expenses/ExpenseHistory";
import { SignedInAs } from "@/components/auth/SignedInAs";
import { OverviewBoard } from "@/components/overview/OverviewBoard";
import { PageHeader } from "@/components/ui/PageHeader";

// The search params are the expense history's filters (#15). They are read
// inside OverviewBoard, under its <Suspense>, not here.
export default function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <PageHeader title="Overview">
        <LogoutButton />
      </PageHeader>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SignedInAs />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Loading your overview…</p>}>
        <OverviewBoard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
