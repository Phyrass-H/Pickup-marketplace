// Layout + guard for the signed-in Business (Dispatch) area. Each page sets its
// own <main> width (the schedule/calendar are wide; the form is narrow).
// Non-dispatchers are routed to where they belong — and on the production
// domain, to the Dispatch subdomain (dispatch.*) specifically.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DispatchShell } from "@/components/dispatch-shell";
import { getAppContext, routeFor } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
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

  // Draft count for the sidebar badge. Kept fresh after save / post / discard by
  // revalidatePath("/dispatch", "layout") in those server actions.
  const supabase = await createClient();
  const { count: draftCount } = await supabase
    .from("mission")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ctx.business.id)
    .eq("status", "draft");

  return (
    <DispatchShell
      businessName={ctx.business.name}
      logoUrl={ctx.business.logo_url}
      draftCount={draftCount ?? 0}
    >
      {children}
    </DispatchShell>
  );
}
