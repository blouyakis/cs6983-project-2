import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SignedInAs } from "@/components/auth/SignedInAs";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OverviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <PageHeader title="Overview">
        <LogoutButton />
      </PageHeader>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SignedInAs />
      </Suspense>
      {/* TODO(#23): show the personal space and groups here. */}
    </main>
  );
}
