"use client";

// The Driver app's bottom tab bar (replaces the old top text-nav). Mobile-first,
// fixed to the bottom, four destinations. Pool also owns the /missions/[id] detail
// (a Pool trip opened pre-accept), so it stays highlighted there.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Car, Wallet, Settings } from "lucide-react";

const TABS = [
  { href: "/pool", label: "Pool", Icon: Layers, match: (p: string) => p.startsWith("/pool") || p.startsWith("/missions") },
  { href: "/rides", label: "My Rides", Icon: Car, match: (p: string) => p.startsWith("/rides") },
  { href: "/earnings", label: "Earnings", Icon: Wallet, match: (p: string) => p.startsWith("/earnings") },
  // "Account", not "Settings": the tab holds who you are, your car and your papers —
  // preferences are the smallest thing on it (S48).
  { href: "/settings", label: "Account", Icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function DriverTabbar({ checkInCount = 0 }: { checkInCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="dtabbar" aria-label="Main">
      <div className="dtabbar__inner">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          // D61 — a count, not a dot (founder): two trips waiting on a check-in
          // is a different morning from one. Only My Rides carries it.
          const badge = href === "/rides" ? checkInCount : 0;
          return (
            <Link
              key={href}
              href={href}
              className={active ? "dtab dtab--active" : "dtab"}
              aria-current={active ? "page" : undefined}
            >
              <span className="dtab__ic">
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                {badge > 0 && <span className="dtab__badge">{badge}</span>}
              </span>
              <span>
                {label}
                {badge > 0 && (
                  <span className="sr-only">
                    {" "}
                    — {badge} trip{badge === 1 ? "" : "s"} to check in
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
