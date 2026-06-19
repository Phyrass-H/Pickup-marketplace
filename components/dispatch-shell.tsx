"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  List,
  CalendarDays,
  FileText,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dispatch", label: "Schedule", icon: List },
  { href: "/dispatch/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dispatch/drafts", label: "Drafts", icon: FileText },
  { href: "/dispatch/history", label: "History", icon: HistoryIcon },
] as const;

const TITLES: Record<string, string> = {
  "/dispatch": "Schedule",
  "/dispatch/calendar": "Calendar",
  "/dispatch/drafts": "Drafts",
  "/dispatch/history": "History",
  "/dispatch/new": "New mission",
  "/dispatch/settings": "Settings",
};

const STORAGE_KEY = "pickup-dx-collapsed";

export function DispatchShell({
  businessName,
  logoUrl,
  children,
}: {
  businessName: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted collapsed state after mount (avoids hydration mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function signOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  const title = TITLES[pathname] ?? "Dispatch";

  return (
    <div className="dx-shell">
      <aside className={`dx-sidebar${collapsed ? " is-collapsed" : ""}`}>
        <div className="dx-sidebar__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="" aria-hidden="true" />
          <span className="dx-label dx-brandname">
            PickUp{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
              Dispatch
            </span>
          </span>
          <button
            className="dx-toggle"
            onClick={toggle}
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            title={collapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>

        <nav className="dx-nav">
          <Link
            href="/dispatch/new"
            className={`dx-navitem dx-navitem--cta${pathname === "/dispatch/new" ? " is-active" : ""}`}
            title="New mission"
          >
            <Plus />
            <span className="dx-label">New mission</span>
          </Link>
          <div className="dx-navsep" />
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`dx-navitem${pathname === href ? " is-active" : ""}`}
              title={label}
            >
              <Icon />
              <span className="dx-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="dx-sidebar__foot">
          <Link
            href="/dispatch/settings"
            className={`dx-navitem${pathname === "/dispatch/settings" ? " is-active" : ""}`}
            title="Settings"
          >
            <SettingsIcon />
            <span className="dx-label">Settings</span>
          </Link>
          <div className="dx-acct">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="dx-acct__avatar" src={logoUrl} alt="" />
            ) : (
              <span className="dx-acct__avatar" aria-hidden="true">
                {businessName.charAt(0)}
              </span>
            )}
            <span className="dx-label" style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {businessName}
              </span>
              <button
                className="dx-link"
                style={{ fontSize: 12 }}
                onClick={signOut}
                disabled={pending}
              >
                {pending ? "…" : "Sign out"}
              </button>
            </span>
          </div>
        </div>
      </aside>

      <div className="dx-content">
        <div className="dx-topbar">
          <span className="dx-topbar__title">{title}</span>
        </div>
        <main className="dx-main">{children}</main>
      </div>
    </div>
  );
}
