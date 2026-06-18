import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { devLoginHref } from "@/lib/hosts";

// DEV-ONLY friendly sign-in. Local: open. Hosted: only reachable with the right
// ?key= (matching DEV_LOGIN_KEY), which is also forwarded to the sign-in links.
// On the production domain each button points at its OWN subdomain's dev-login
// endpoint, so the host-only session cookie lands on driver.* / dispatch.*
// respectively — you stay signed in as both at once, no role switching.
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
  const host = (await headers()).get("host");

  const businessHref = devLoginHref(host, "dispatch", `?as=business${keyQ}`);
  const driverHref = devLoginHref(host, "driver", `?as=driver${keyQ}`);

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>PickUp — quick sign-in</h1>
        <p className="muted" style={{ marginTop: -8 }}>
          Testing only. No email needed — pick a side. On the live domain each
          side opens on its own subdomain, so you can stay signed in as both.
        </p>

        <div className="card">
          <h2>Business (Dispatch)</h2>
          <p className="muted small">Post missions and manage the schedule.</p>
          <a className="btn" href={businessHref}>
            Sign in as demo Business
          </a>
        </div>

        <div className="card">
          <h2>Driver</h2>
          <p className="muted small">Browse the Pool and run missions.</p>
          <a className="btn secondary" href={driverHref}>
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
