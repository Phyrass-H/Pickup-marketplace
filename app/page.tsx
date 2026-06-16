import { redirect } from "next/navigation";
import { getAppContext, routeFor } from "@/lib/app-context";

// Entry point: route the visitor to the right place for their role + state.
export default async function Home() {
  const ctx = await getAppContext();
  redirect(routeFor(ctx));
}
