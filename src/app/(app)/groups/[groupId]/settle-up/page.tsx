import { Suspense } from "react";
import { SettleUpDetail } from "@/components/settle-up/SettleUpDetail";

export default function SettleUpPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-muted">Loading the settle-up…</p>}>
        <SettleUpDetail params={params} />
      </Suspense>
    </main>
  );
}
