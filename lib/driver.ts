// Server helper: resolve the logged-in Auth user to their Driver + Vehicle.
// One Vehicle per Driver in V1 (Doc spine), so we take the first.
import { createClient } from "@/lib/supabase/server";
import type { DriverRow, VehicleRow } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

export interface DriverContext {
  user: User | null;
  driver: DriverRow | null;
  vehicle: VehicleRow | null;
}

export async function getDriverContext(): Promise<DriverContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, driver: null, vehicle: null };

  const { data: driver } = await supabase
    .from("driver")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let vehicle: VehicleRow | null = null;
  if (driver) {
    const { data: v } = await supabase
      .from("vehicle")
      .select("*")
      .eq("driver_id", driver.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    vehicle = v;
  }

  return { user, driver, vehicle };
}
