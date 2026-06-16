import { redirect } from "next/navigation";
import { getDriverContext } from "@/lib/driver";

// Entry point: route the visitor to the right place based on their state.
export default async function Home() {
  const { user, driver, vehicle } = await getDriverContext();
  if (!user) redirect("/login");
  if (!driver || !vehicle) redirect("/onboarding");
  redirect("/pool");
}
