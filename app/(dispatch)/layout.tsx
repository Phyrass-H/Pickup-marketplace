// Layout + guard for the signed-in Business (Dispatch) area. Each page sets its
// own <main> width (the schedule/calendar are wide; the form is narrow).
// Non-dispatchers are routed to where they belong — and on the production
// domain, to the Dispatch subdomain (dispatch.*) specifically.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DispatchShell } from "@/components/dispatch-shell";
import { getAppContext, routeFor } from "@/lib/app-context";
import { urlForRole, isProdDomain, roleSubOf, homePathForSub, PROD_BASE } from "@/lib/hosts";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();
  const host = (await headers()).get("host");

  if (!ctx.user) redirect("/login");
  // Wrong role → their area (crossing subdomain on production).
  if (ctx.profile?.role !== "dispatcher") {
    redirect(urlForRole(host, ctx.profile?.role, routeFor(ctx)));
  }
  // Right role, wrong subdomain (production only) → bounce to the Dispatch host.
  if (isProdDomain(host) && roleSubOf(host) !== "dispatch") {
    redirect(`https://dispatch.${PROD_BASE}${homePathForSub("dispatch")}`);
  }
  if (!ctx.dispatcher || !ctx.business) redirect("/onboarding-business");

  return (
    <DispatchShell businessName={ctx.business.name} logoUrl={ctx.business.logo_url}>
      {children}
    </DispatchShell>
  );
}
