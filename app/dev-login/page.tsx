import Link from "next/link";
import { notFound } from "next/navigation";

// DEV-ONLY friendly sign-in page. Two buttons, no email, no Supabase config.
export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) notFound();

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>PickUp — quick sign-in</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          Local testing only. No email needed — just pick a side. Use one, try it,
          then sign out and pick the other to see the full loop.
        </p>

        <div className="card">
          <h2>Business (Dispatch)</h2>
          <p className="muted small">Post missions to the Pool.</p>
          {/* Plain links to a GET route so a click signs you in. */}
          <a className="btn" href="/api/dev-login?as=business">
            Sign in as demo Business
          </a>
        </div>

        <div className="card">
          <h2>Driver</h2>
          <p className="muted small">Browse the Pool and accept missions.</p>
          <a className="btn secondary" href="/api/dev-login?as=driver">
            Sign in as demo Driver
          </a>
        </div>

        <p className="small" style={{ marginTop: 12 }}>
          <Link href="/login" className="muted">
            ← Use email sign-in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
