import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAppContext, routeFor } from "@/lib/app-context";
import { urlForRole, isProdDomain, roleSubOf } from "@/lib/hosts";
import { LandingSplash } from "@/components/landing-splash";

// Entry point. On the bare production domain (pickupbedriven.com / www — no role
// subdomain) show the public splash. Everywhere else, route the visitor to the
// right place for their role + state (crossing to their subdomain on prod).
export default async function Home() {
  const host = (await headers()).get("host");
  if (isProdDomain(host) && roleSubOf(host) === null) {
    return <LandingSplash />;
  }
  const ctx = await getAppContext();
  redirect(urlForRole(host, ctx.profile?.role, routeFor(ctx)));
}
