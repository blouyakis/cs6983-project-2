"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { name: string } | null | undefined;

export function AuthNav() {
  const router = useRouter();
  const [user, setUser] = useState<User>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  if (user === undefined) return null;

  return user ? (
    <p>
      Signed in as {user.name}.{" "}
      <button type="button" onClick={logout} className="underline">
        Log out
      </button>
    </p>
  ) : (
    <p>
      <Link href="/login" className="underline">
        Log in
      </Link>{" "}
      or{" "}
      <Link href="/register" className="underline">
        register
      </Link>
    </p>
  );
}
