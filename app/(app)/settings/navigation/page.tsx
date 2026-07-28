import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { SegField } from "@/components/seg-field";
import { SettingsHeader, SaveNotice } from "@/components/settings-header";
import { updateNavigation } from "../actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  db: "Something went wrong saving your changes. Please try again.",
};

const APPS = [
  { value: "waze", label: "Waze" },
  { value: "google", label: "Google" },
  { value: "apple", label: "Apple" },
] as const;

export default async function NavigationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");
  const driver = ctx.driver;
  const { ok, error } = await searchParams;

  return (
    <>
      <SettingsHeader title="Navigation" sub="Which app opens when you tap Navigate on a trip." />
      <SaveNotice ok={ok} error={error} messages={NOTICE} />

      <form action={updateNavigation}>
        <div className="dcard">
          <SegField
            name="preferred_gps"
            label="Navigation app"
            options={APPS}
            defaultValue={driver.preferred_gps ?? "google"}
          />
          <p className="dhint dhint--block">
            If the app isn’t installed on this phone, we’ll open the route in your browser
            instead — you’ll still get there.
          </p>
        </div>

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>
    </>
  );
}
