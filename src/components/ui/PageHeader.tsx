import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  // Decorative, so it is hidden from screen readers; the title says it all.
  emoji?: string;
  // One line under the title, such as "Dorm 4B · period since Oct 1".
  context?: string;
  // Where the phone back button goes. Desktop has the sidebar instead.
  back?: { href: string; label: string };
  // A button or the members' avatars, placed at the right of the title.
  children?: ReactNode;
};

// The top of every signed-in page (DESIGN.md "PageHeader").
export function PageHeader({
  title,
  emoji,
  context,
  back,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="self-start font-semibold underline md:hidden"
        >
          <span aria-hidden="true">← </span>
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">
            {emoji ? <span aria-hidden="true">{emoji} </span> : null}
            {title}
          </h1>
          {context ? (
            <p className="font-semibold text-muted">{context}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex items-center gap-3">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
