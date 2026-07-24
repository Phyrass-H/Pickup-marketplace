// Layout + auth guard for the signed-in Driver area (Pool, mission detail,
// My Rides). Non-drivers are routed to where they belong — and on the production
// domain, to the Driver subdomain (driver.*) specifically.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DriverTabbar } from "@/components/driver-tabbar";
import { getAppContext, routeFor } from "@/lib/app-context";
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

  return (
    <>
      <main className="dapp-main">{children}</main>
      <DriverTabbar />
    </>
  );
}
