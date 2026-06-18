import { MissionForm } from "./mission-form";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; date?: string }>;
}) {
  const { error, date } = await searchParams;
  return (
    <div className="dx-narrow">
      <p className="muted" style={{ marginTop: 0, marginBottom: 14 }}>
        Posts straight into the matching Driver Pool. You set the ceiling; PickUp
        prices it up to that maximum.
      </p>
      <MissionForm error={error} prefillDate={date} />
    </div>
  );
}
