// Public landing for the bare production domain (pickupbedriven.com / www).
// PickUp is an intermediary connecting professional VTC Drivers with Businesses
// — neither side is the "default", so the root just lets a visitor pick which
// app they want and sends them to its subdomain. Design is intentionally light
// (bones only); the real skin comes in the design pass.
import { PROD_BASE } from "@/lib/hosts";

export function LandingSplash() {
  const driverUrl = `https://driver.${PROD_BASE}`;
  const dispatchUrl = `https://dispatch.${PROD_BASE}`;

  return (
    <div className="center-screen">
      <div className="auth-card">
        <div className="auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="auth-logo" src="/logo.png" alt="" aria-hidden="true" />
          <h1>PickUp</h1>
        </div>
        <p className="muted small" style={{ textAlign: "center", marginTop: 0 }}>
          The booking platform linking professional VTC Drivers with Businesses.
        </p>

        <div className="card">
          <h2>I’m a Business</h2>
          <p className="muted small">Post missions and manage your bookings.</p>
          <a className="btn" href={dispatchUrl}>
            Open Dispatch →
          </a>
        </div>

        <div className="card">
          <h2>I’m a Driver</h2>
          <p className="muted small">Browse the Pool and run VTC missions.</p>
          <a className="btn secondary" href={driverUrl}>
            Open the Driver app →
          </a>
        </div>
      </div>
    </div>
  );
}
