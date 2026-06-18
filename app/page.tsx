import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAppContext, routeFor } from "@/lib/app-context";
import { urlForRole } from "@/lib/hosts";

// Entry point: route the visitor to the right place for their role + state.
// On the production domain this also crosses to the role's own subdomain
// (driver.* / dispatch.*); off it, urlForRole just returns the path.
export default async function Home() {
  const ctx = await getAppContext();
  const host = (await headers()).get("host");
  redirect(urlForRole(host, ctx.profile?.role, routeFor(ctx)));
}
