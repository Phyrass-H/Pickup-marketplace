import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContext, routeFor } from "@/lib/app-context";

// First screen after a brand-new sign-in: pick which side of Kavenue you are.
export default async function WelcomePage() {
  const ctx = await getAppContext();
  if (!ctx.user) redirect("/login");
  if (ctx.profile) redirect(routeFor(ctx)); // already has a role

  return (
    <main className="container" style={{ paddingTop: 28 }}>
      <h1>Welcome to Kavenue</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        How will you use Kavenue? Signed in as <strong>{ctx.user.email}</strong>.
      </p>

      <div className="card">
        <h2>I’m a Driver</h2>
        <p className="muted small">Browse the Pool, accept and run VTC missions.</p>
        <Link className="btn" href="/onboarding">
          Continue as Driver
        </Link>
      </div>

      <div className="card">
        <h2>I’m a Business</h2>
        <p className="muted small">
          Post missions and manage bookings (hotel, agency, concierge).
        </p>
        <Link className="btn secondary" href="/onboarding-business">
          Continue as Business
        </Link>
      </div>
    </main>
  );
}
