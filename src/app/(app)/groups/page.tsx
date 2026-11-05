import { Suspense } from "react";
import { GroupsList } from "@/components/groups/GroupsList";
import { NewGroupButton } from "@/components/groups/NewGroupButton";
import { PageHeader } from "@/components/ui/PageHeader";

export default function GroupsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <PageHeader
        title="Your corners of life"
        emoji="👥"
        context="A group can be anything: a home, a trip, a standing date. Name it however you like."
      >
        <NewGroupButton />
      </PageHeader>
      <Suspense fallback={<p className="text-muted">Loading your groups…</p>}>
        <GroupsList />
      </Suspense>
    </main>
  );
}
