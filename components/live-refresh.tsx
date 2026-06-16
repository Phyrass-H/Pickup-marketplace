"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Near-realtime: re-fetch this Server Component on an interval so status changes
// from the other side appear within a few seconds. (Upgrade path: swap for a
// Supabase Realtime websocket subscription once status_event is added to the
// realtime publication.)
export function LiveRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
