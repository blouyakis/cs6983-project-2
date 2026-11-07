import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupTile } from "@/components/groups/GroupTile";
import { getSessionUserId } from "@/lib/auth/cookies";
import { getOverview } from "@/lib/services/overview-service";

function openItems(count: number): string {
  return count === 0 ? "Nothing open on the list" : `${count} open on the list`;
}

// The Lists landing page (#68). Lists the personal space first, then each
// active shared group with its open items count. Reads the session, so render
// it inside <Suspense>.
export async function ListsBoard() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  const { personal, groups } = await getOverview(userId);

  return (
    <div className="flex flex-col gap-8">
      {personal ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-muted uppercase">
            Just you
          </h2>
          <Link
            href={`/groups/${personal.group.id}`}
            className="flex items-center gap-4 rounded-2xl border-4 border-ink bg-surface p-4 hover:shadow-[4px_4px_0_0_var(--color-ink)]"
          >
            <GroupTile name="🔒" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold">
                {personal.group.name}
              </h3>
              <p className="text-sm font-semibold text-muted">
                <span>{openItems(personal.openItems.length)}</span>
                <span> · Private list</span>
              </p>
            </div>
            <span aria-hidden="true" className="text-xl text-owe">
              ›
            </span>
          </Link>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-wide text-muted uppercase">
          Shared lists
        </h2>
        {groups.length === 0 ? (
          <p>
            No shared groups yet.{" "}
            <Link href="/groups" className="font-bold text-owe underline">
              Create one
            </Link>{" "}
            to share shopping lists and plans with others.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex items-center gap-4 rounded-2xl border-4 border-ink bg-surface p-4 hover:shadow-[4px_4px_0_0_var(--color-ink)]"
                >
                  <GroupTile name={group.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold">{group.name}</h3>
                    <p className="text-sm font-semibold text-muted">
                      {openItems(group.openItemCount)}
                    </p>
                  </div>
                  <span aria-hidden="true" className="text-xl text-owe">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
