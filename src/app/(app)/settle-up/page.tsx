import { Suspense } from "react";
import { SettleUpBoard } from "@/components/settle-up/SettleUpBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettleUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <PageHeader title="Settle up" />
      <Suspense fallback={<p className="text-muted">Loading your groups…</p>}>
        <SettleUpBoard />
      </Suspense>
    </main>
  );
}
