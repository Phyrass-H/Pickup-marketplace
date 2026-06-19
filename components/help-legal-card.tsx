import Link from "next/link";

const APP_VERSION = "beta";

// Shared "Help & legal" block for both the Driver and Dispatch settings pages.
// Email targets are placeholders until a real support mailbox is set up.
export function HelpLegalCard() {
  const link = {
    display: "block",
    padding: "11px 2px",
    borderTop: "1px solid var(--border)",
  } as const;

  return (
    <div className="card">
      <h2>Help &amp; legal</h2>
      <div style={{ marginTop: 4 }}>
        <Link href="/legal/terms" style={link}>
          Terms of use
        </Link>
        <Link href="/legal/privacy" style={link}>
          Privacy policy
        </Link>
        <a href="mailto:support@pickupbedriven.com" style={link}>
          Support
        </a>
        <a
          href="mailto:feedback@pickupbedriven.com?subject=PickUp%20feedback"
          style={link}
        >
          Share feedback
        </a>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        PickUp · {APP_VERSION}
      </p>
    </div>
  );
}
