import Link from "next/link";
import { notFound } from "next/navigation";

// DEV-ONLY friendly sign-in. Local: open. Hosted: only reachable with the right
// ?key= (matching DEV_LOGIN_KEY), which is also forwarded to the sign-in links.
export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const hosted = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const { key } = await searchParams;
  if (hosted && (!process.env.DEV_LOGIN_KEY || key !== process.env.DEV_LOGIN_KEY)) {
    notFound();
  }
  const keyQ = key ? `&key=${encodeURIComponent(key)}` : "";

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>PickUp — quick sign-in</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          Testing only. No email needed — pick a side. Use one, try it, then sign
          out and pick the other to see the full loop.
        </p>

        <div className="card">
          <h2>Business (Dispatch)</h2>
          <p className="muted small">Post missions and manage the schedule.</p>
          <a className="btn" href={`/api/dev-login?as=business${keyQ}`}>
            Sign in as demo Business
          </a>
        </div>

        <div className="card">
          <h2>Driver</h2>
          <p className="muted small">Browse the Pool and run missions.</p>
          <a className="btn secondary" href={`/api/dev-login?as=driver${keyQ}`}>
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
