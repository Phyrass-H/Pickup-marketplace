// Layout + auth guard for the signed-in Driver area (Pool, mission detail,
// My Rides). No user → /login. User but no Driver/Vehicle yet → /onboarding.
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getDriverContext } from "@/lib/driver";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, driver, vehicle } = await getDriverContext();

  if (!user) redirect("/login");
  if (!driver || !vehicle) redirect("/onboarding");

  return (
    <>
      <AppHeader />
      <main className="container">{children}</main>
    </>
  );
}
