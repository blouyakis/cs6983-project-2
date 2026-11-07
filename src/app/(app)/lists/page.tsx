import { Suspense } from "react";
import { ListsBoard } from "@/components/lists/ListsBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ListsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <PageHeader title="Lists" />
      <Suspense fallback={<p className="text-muted">Loading your lists…</p>}>
        <ListsBoard />
      </Suspense>
    </main>
  );
}
