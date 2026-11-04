import Link from "next/link";
import { Suspense } from "react";
import { GroupDetail } from "@/components/groups/GroupDetail";

export default function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/groups" className="font-semibold underline">
        <span aria-hidden="true">← </span>All groups
      </Link>
      <Suspense fallback={<p className="text-muted">Loading the group…</p>}>
        <GroupDetail params={params} />
      </Suspense>
    </main>
  );
}
