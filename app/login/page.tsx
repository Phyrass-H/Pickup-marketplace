import { redirect } from "next/navigation";
import { getDriverContext } from "@/lib/driver";
import { LoginForm } from "./login-form";

// Server wrapper: route already-authenticated users onward instead of showing
// them the sign-in form again, and pass any callback error to the form.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, driver, vehicle } = await getDriverContext();
  if (user) {
    redirect(driver && vehicle ? "/pool" : "/onboarding");
  }

  const { error } = await searchParams;
  return <LoginForm initialError={error ?? null} />;
}
