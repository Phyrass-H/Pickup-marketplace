// Role-aware session context. One app serves both surfaces (Driver PWA +
// Dispatch) keyed off profile.role. Use this for routing and area guards;
// the Driver pages also have getDriverContext for their narrower needs.
import { createClient } from "@/lib/supabase/server";
import type {
  ProfileRow,
  DriverRow,
  VehicleRow,
  DispatcherRow,
  BusinessRow,
} from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

export interface AppContext {
  user: User | null;
  profile: ProfileRow | null;
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
  dispatcher: DispatcherRow | null;
  business: BusinessRow | null;
}

export async function getAppContext(): Promise<AppContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty: AppContext = {
    user: null,
    profile: null,
    driver: null,
    vehicle: null,
    dispatcher: null,
    business: null,
  };
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profile")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const ctx: AppContext = { ...empty, user, profile: profile ?? null };

  if (profile?.role === "driver") {
    const { data: driver } = await supabase
      .from("driver")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    ctx.driver = driver ?? null;
    if (driver) {
      const { data: vehicle } = await supabase
        .from("vehicle")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      ctx.vehicle = vehicle ?? null;
    }
  } else if (profile?.role === "dispatcher") {
    const { data: dispatcher } = await supabase
      .from("dispatcher")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    ctx.dispatcher = dispatcher ?? null;
    if (dispatcher) {
      const { data: business } = await supabase
        .from("business")
        .select("*")
        .eq("id", dispatcher.business_id)
        .maybeSingle();
      ctx.business = business ?? null;
    }
  }

  return ctx;
}

/** Where this user belongs right now. Never returns "/" or "/login" for a
 *  logged-in user, so it's safe to redirect to from "/" and "/login". */
export function routeFor(ctx: AppContext): string {
  if (!ctx.user) return "/login";
  if (!ctx.profile) return "/welcome";
  if (ctx.profile.role === "driver") {
    return ctx.driver && ctx.vehicle ? "/pool" : "/onboarding";
  }
  if (ctx.profile.role === "dispatcher") {
    return ctx.dispatcher && ctx.business ? "/dispatch" : "/onboarding-business";
  }
  return "/welcome";
}
