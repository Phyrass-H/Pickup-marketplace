// Layout + guard for the signed-in Business (Dispatch) area.
import { redirect } from "next/navigation";
import { DispatchHeader } from "@/components/dispatch-header";
import { getAppContext, routeFor } from "@/lib/app-context";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAppContext();

  if (!ctx.user) redirect("/login");
  if (ctx.profile?.role !== "dispatcher") redirect(routeFor(ctx));
  if (!ctx.dispatcher || !ctx.business) redirect("/onboarding-business");

  return (
    <>
      <DispatchHeader businessName={ctx.business.name} />
      <main className="container">{children}</main>
    </>
  );
}
