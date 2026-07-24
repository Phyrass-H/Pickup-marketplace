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
  { href: "/settings", label: "Settings", Icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export function DriverTabbar() {
  const pathname = usePathname();

  return (
    <nav className="dtabbar" aria-label="Main">
      <div className="dtabbar__inner">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "dtab dtab--active" : "dtab"}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
