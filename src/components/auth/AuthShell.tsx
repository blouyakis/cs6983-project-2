import type { ReactNode } from "react";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold">LifeBoard</h1>
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-sm rounded-2xl border-[3px] border-ink bg-surface p-6 shadow-[6px_6px_0_0_var(--color-ink)]"
      >
        <h2 id="auth-title" className="mb-4 text-xl font-bold">
          {title}
        </h2>
        {children}
      </section>
    </main>
  );
}
