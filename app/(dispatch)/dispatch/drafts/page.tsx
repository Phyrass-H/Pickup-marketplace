import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import { categoryLabel, formatDateTime, formatMoney } from "@/lib/format";
import { DraftActions } from "@/components/draft-actions";

export const dynamic = "force-dynamic";

export default async function DispatchDrafts() {
  const ctx = await getAppContext();
  if (!ctx.business) return null;

  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("mission")
    .select("*")
    .eq("business_id", ctx.business.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  const list = drafts ?? [];

  return (
    <div className="dx-narrow">
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
        Missions you saved but haven&apos;t posted. Continue editing to review and
        send one to the Pool.
      </p>

      {list.length === 0 ? (
        <div className="empty">
          No drafts.
          <br />
          <Link href="/dispatch/new" style={{ textDecoration: "underline" }}>
            Create a mission →
          </Link>
        </div>
      ) : (
        list.map((m) => (
          <div className="card" key={m.id}>
            <div className="card-row">
              <span style={{ fontWeight: 600 }}>{formatDateTime(m.pickup_at)}</span>
              <span className="badge">{categoryLabel(m.category)}</span>
            </div>
            <div className="route" style={{ marginTop: 6 }}>
              <div className="leg">
                <span className="dot" />
                <span>{m.pickup_address}</span>
              </div>
              <div className="leg">
                <span className="dot end" />
                <span>{m.dropoff_address ?? "—"}</span>
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              Ceiling {formatMoney(m.ceiling)}
            </div>
            <DraftActions missionId={m.id} editHref={`/dispatch/new?draft=${m.id}`} />
          </div>
        ))
      )}
    </div>
  );
}
