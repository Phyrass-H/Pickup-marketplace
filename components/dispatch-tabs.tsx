"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dispatch", label: "Schedule" },
  { href: "/dispatch/calendar", label: "Calendar" },
  { href: "/dispatch/history", label: "History" },
  { href: "/dispatch/new", label: "+ New mission" },
  { href: "/dispatch/settings", label: "Settings" },
];

export function DispatchTabs() {
  const pathname = usePathname();
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={pathname === t.href ? "active" : ""}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
