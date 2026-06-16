"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="app-header">
      <div className="container">
        <Link href="/pool" className="brand">
          PickUp
        </Link>
        <nav>
          <Link href="/pool" className={isActive("/pool") ? "active" : ""}>
            Pool
          </Link>
          <Link href="/rides" className={isActive("/rides") ? "active" : ""}>
            My Rides
          </Link>
          <button
            onClick={signOut}
            disabled={pending}
            className="small"
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              opacity: 0.85,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {pending ? "…" : "Sign out"}
          </button>
        </nav>
      </div>
    </header>
  );
}
