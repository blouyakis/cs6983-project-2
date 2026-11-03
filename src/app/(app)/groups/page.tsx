import { Suspense } from "react";
import { GroupsList } from "@/components/groups/GroupsList";
import { NewGroupButton } from "@/components/groups/NewGroupButton";

export default function GroupsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            <span aria-hidden="true">👥 </span>Your corners of life
          </h1>
          <p className="font-semibold text-muted">
            A group can be anything: a home, a trip, a standing date. Name it
            however you like.
          </p>
        </div>
        <NewGroupButton />
      </header>
      <Suspense fallback={<p className="text-muted">Loading your groups…</p>}>
        <GroupsList />
      </Suspense>
    </main>
  );
}
