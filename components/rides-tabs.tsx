import Link from "next/link";

// My Rides is two screens, not a screen with a link in its corner: Upcoming (the
// live work) and Past (the archive). They stay two ROUTES — /rides and
// /rides/history — so each keeps its own server query and every existing deep
// link (the "← History" back link on a finished trip) still lands correctly.
// A count only shows when there's something to count; a "0" is noise the empty
// state already says better.
export function RidesTabs({
  active,
  upcoming,
  past,
}: {
  active: "upcoming" | "past";
  upcoming: number;
  past: number;
}) {
  const tabs = [
    { key: "upcoming" as const, href: "/rides", label: "Upcoming", n: upcoming },
    { key: "past" as const, href: "/rides/history", label: "Past", n: past },
  ];

  return (
    <nav className="rtabs" aria-label="My Rides">
      {tabs.map(({ key, href, label, n }) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={on ? "rtab rtab--active" : "rtab"}
            aria-current={on ? "page" : undefined}
          >
            {label}
            {n > 0 && <span className="rtab__n">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
