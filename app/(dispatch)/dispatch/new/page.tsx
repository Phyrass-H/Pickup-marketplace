import { MissionForm } from "./mission-form";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/app-context";
import type { MissionRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; date?: string; draft?: string }>;
}) {
  const { error, date, draft } = await searchParams;

  // Resume a saved draft (gated to this Business by RLS). Only draft rows.
  let draftMission: MissionRow | null = null;
  if (draft) {
    const ctx = await getAppContext();
    if (ctx.business) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("mission")
        .select("*")
        .eq("id", draft)
        .eq("status", "draft")
        .maybeSingle();
      draftMission = data ?? null;
    }
  }

  return (
    <div className="dx-narrow">
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
        Review it before it goes live. Posts into the matching Driver Pool — you
        set the ceiling; PickUp prices up to that maximum.
      </p>
      <MissionForm error={error} prefillDate={date} draft={draftMission} />
    </div>
  );
}
