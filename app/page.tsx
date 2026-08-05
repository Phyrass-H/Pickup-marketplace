import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAppContext, routeFor } from "@/lib/app-context";
import { urlForRole } from "@/lib/hosts";

// Entry point: route the visitor to the right place for their role + state,
// crossing to their subdomain on production.
//
// ⚑ There is no public splash here any more. Until 2026-08-05 this returned a
// <LandingSplash /> when the host was the bare production domain, because
// kavenue.fr pointed at this project. The apex now belongs to a SEPARATE Vercel
// project (the marketing site, its own repo — see project/LANDING_HANDOFF.md), so
// this app only ever receives driver.kavenue.fr and dispatch.kavenue.fr in
// production. The branch was unreachable, and unreachable branches rot.
export default async function Home() {
  const host = (await headers()).get("host");
  const ctx = await getAppContext();
  redirect(urlForRole(host, ctx.profile?.role, routeFor(ctx)));
}
