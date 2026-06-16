import { MissionForm } from "./mission-form";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <h1>New mission</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Posts straight into the matching Driver Pool. You set the ceiling; PickUp
        prices it up to that maximum.
      </p>
      <MissionForm error={error} />
    </>
  );
}
