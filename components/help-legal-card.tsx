import Link from "next/link";

const APP_VERSION = "beta";

// Shared "Help & legal" block for both the Driver and Dispatch settings pages.
// Both addresses are free aliases on the Kavenue Google Workspace account, so
// they land in one inbox — see `project/DOMAIN_MIGRATION.md`.
// `variant` only picks the surrounding card vocabulary: Dispatch still uses the
// generic `.card` + <h2>, the Driver app uses the S43+ `.dcard` language.
export function HelpLegalCard({ variant = "dispatch" }: { variant?: "dispatch" | "driver" }) {
  const isDriver = variant === "driver";
  const link = {
    display: "block",
    padding: "11px 2px",
    borderTop: "1px solid var(--border)",
  } as const;

  return (
    <div className={isDriver ? "dcard" : "card"}>
      {isDriver ? (
        <p className="dcard__label">Help and legal</p>
      ) : (
        <h2>Help &amp; legal</h2>
      )}
      <div style={{ marginTop: isDriver ? -6 : 4 }}>
        <Link href="/legal/terms" style={link}>
          Terms of use
        </Link>
        <Link href="/legal/privacy" style={link}>
          Privacy policy
        </Link>
        <a href="mailto:support@kavenue.fr" style={link}>
          Support
        </a>
        <a
          href="mailto:feedback@kavenue.fr?subject=Kavenue%20feedback"
          style={link}
        >
          Share feedback
        </a>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        Kavenue · {APP_VERSION}
      </p>
    </div>
  );
}
