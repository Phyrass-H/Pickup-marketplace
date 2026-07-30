// Layout + auth guard for the signed-in Driver area (Pool, mission detail,
// My Rides). Non-drivers are routed to where they belong — and on the production
// domain, to the Driver subdomain (driver.*) specifically.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DriverTabbar } from "@/components/driver-tabbar";
import { getAppContext, routeFor } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { CHECK_IN_GRACE_MS, CHECK_IN_OPENS_MS } from "@/lib/dispatch-status";
import { urlForRole, isProdDomain, roleSubOf, homePathForSub, PROD_BASE } from "@/lib/hosts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();
  const host = (await headers()).get("host");

  if (!ctx.user) redirect("/login");
  // Wrong role → their area (crossing subdomain on production).
  if (ctx.profile?.role !== "driver") {
    redirect(urlForRole(host, ctx.profile?.role, routeFor(ctx)));
  }
  // Right role, wrong subdomain (production only) → bounce to the Driver host.
  if (isProdDomain(host) && roleSubOf(host) !== "driver") {
    redirect(`https://driver.${PROD_BASE}${homePathForSub("driver")}`);
  }
  if (!ctx.driver || !ctx.vehicle) redirect("/onboarding");

  // D61 — how many trips are waiting on a check-in, for the My Rides tab badge.
  // Counted here rather than in the page so it shows wherever the Driver is in
  // the app: without push, the badge IS the notification. `head: true` sends the
  // count only — no rows over the wire. Mirrors checkInOpen() in SQL terms.
  const supabase = await createClient();
  const { count: checkInCount } = await supabase
    .from("mission")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", ctx.driver.id)
    .eq("status", "confirmed")
    .is("checked_in_at", null)
    .lte("pickup_at", new Date(Date.now() + CHECK_IN_OPENS_MS).toISOString())
    // Both bounds, or a trip left `confirmed` since last month counts forever.
    .gte("pickup_at", new Date(Date.now() - CHECK_IN_GRACE_MS).toISOString());

  return (
    <>
      <main className="dapp-main">{children}</main>
      <DriverTabbar checkInCount={checkInCount ?? 0} />
    </>
  );
}
