// Service-role Supabase client — SERVER ONLY. BYPASSES RLS.
// Use ONLY for:
//   • seeding/admin writes the browser is not allowed to do, and
//   • the "reveal contact on acceptance" gate, where we must enforce the
//     unlock rule in code (RLS can't express "driver of THIS mission").
// Never import this into a client component.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { serviceRoleKey } from "@/lib/env";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.supabaseUrl,
    serviceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
