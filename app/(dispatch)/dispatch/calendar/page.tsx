import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { formatTime } from "@/lib/format";
import { missionTone, parisDayKey, TONE_COLOR } from "@/lib/dispatch-status";
import { DispatchTabs } from "@/components/dispatch-tabs";
import { LiveRefresh } from "@/components/live-refresh";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const DOW = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DispatchCalendar({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const { month } = await searchParams;
  const todayKey = parisDayKey(new Date());
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : todayKey.slice(0, 7);
  const [year, mon] = ym.split("-").map(Number);

  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 1));
  const qStart = new Date(monthStart.getTime() - 86_400_000).toISOString();
  const qEnd = new Date(monthEnd.getTime() + 86_400_000).toISOString();

  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .gte("pickup_at", qStart)
    .lt("pickup_at", qEnd)
    .order("pickup_at", { ascending: true });

  // Bucket missions into this month's days.
  const byDay = new Map<number, MissionRow[]>();
  for (const m of missions ?? []) {
    const key = parisDayKey(m.pickup_at);
    if (!key.startsWith(`${ym}-`)) continue;
    const day = Number(key.slice(8, 10));
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(m);
  }

  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const firstDow = (monthStart.getUTCDay() + 6) % 7; // 0 = Monday
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const title = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  return (
    <main className="container wide">
      <DispatchTabs />
      <LiveRefresh intervalMs={8000} />

      <div className="cal-head">
        <Link className="btn secondary" style={{ width: "auto" }} href={`/dispatch/calendar?month=${shiftMonth(ym, -1)}`}>
          ← Prev
        </Link>
        <h1 style={{ margin: 0, textTransform: "capitalize" }}>{title}</h1>
        <Link className="btn secondary" style={{ width: "auto" }} href={`/dispatch/calendar?month=${shiftMonth(ym, 1)}`}>
          Next →
        </Link>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div className="cal-dow" key={d}>
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div className="cal-cell muted-cell" key={`b${i}`} />;
          const key = `${ym}-${String(day).padStart(2, "0")}`;
          const dayMissions = byDay.get(day) ?? [];
          const shown = dayMissions.slice(0, 3);
          const extra = dayMissions.length - shown.length;
          return (
            <div className={`cal-cell${key === todayKey ? " today-cell" : ""}`} key={key}>
              <div className="cal-date">{day}</div>
              {shown.map((m) => {
                const t = missionTone(m);
                return (
                  <div className="cal-entry" key={m.id} title={`${m.pickup_address} → ${m.dropoff_address ?? ""}`}>
                    <span className="dot" style={{ background: TONE_COLOR[t.tone] }} />
                    <span>
                      {formatTime(m.pickup_at)} {m.pickup_address}
                    </span>
                  </div>
                );
              })}
              {extra > 0 && <div className="cal-more">+{extra} more</div>}
            </div>
          );
        })}
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        Tip: the <Link href="/dispatch" style={{ textDecoration: "underline" }}>Schedule</Link> view
        lists every trip by day with full detail and live status.
      </p>
    </main>
  );
}
