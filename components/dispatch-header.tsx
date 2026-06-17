"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function DispatchHeader({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl?: string | null;
}) {
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

  return (
    <header className="app-header">
      <div className="container wide">
        <Link href="/dispatch" className="brand">
          PickUp Dispatch
        </Link>
        <nav>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="biz-logo" src={logoUrl} alt={`${businessName} logo`} />
          )}
          <span className="small" style={{ opacity: 0.85 }}>
            {businessName}
          </span>
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
