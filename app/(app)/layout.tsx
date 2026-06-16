// Layout + auth guard for the signed-in Driver area (Pool, mission detail,
// My Rides). Non-drivers are routed to where they belong.
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getAppContext, routeFor } from "@/lib/app-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();

  if (!ctx.user) redirect("/login");
  if (ctx.profile?.role !== "driver") redirect(routeFor(ctx));
  if (!ctx.driver || !ctx.vehicle) redirect("/onboarding");

  return (
    <>
      <AppHeader />
      <main className="container">{children}</main>
    </>
  );
}
