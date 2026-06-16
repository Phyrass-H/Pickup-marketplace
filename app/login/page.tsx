import { redirect } from "next/navigation";
import { getAppContext, routeFor } from "@/lib/app-context";
import { LoginForm } from "./login-form";

// Server wrapper: route already-authenticated users onward (by role) instead of
// showing them the sign-in form again, and pass any callback error to the form.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getAppContext();
  if (ctx.user) redirect(routeFor(ctx));

  const { error } = await searchParams;
  const devEnabled =
    process.env.NODE_ENV !== "production" && !process.env.VERCEL;
  return <LoginForm initialError={error ?? null} devEnabled={devEnabled} />;
}
