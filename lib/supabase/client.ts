// Browser Supabase client — uses the publishable/anon key. RLS applies.
// Used in client components, mainly for auth (signInWithOtp, signOut).
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
