import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getAppContext } from "@/lib/app-context";
import { DriverVehicleFields } from "@/components/driver-vehicle-fields";
import { SettingsHeader, SaveNotice } from "@/components/settings-header";
import { updateVehicle } from "../actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, string> = {
  db: "Something went wrong saving your changes. Please try again.",
};

export default async function VehicleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");
  const { driver, vehicle } = ctx;
  const { ok, error } = await searchParams;

  return (
    <>
      <SettingsHeader title="Your vehicle" sub="The car a Business is told to expect." />
      <SaveNotice ok={ok} error={error} messages={NOTICE} />

      <form action={updateVehicle}>
        <div className="dcard">
          <DriverVehicleFields
            defaults={{
              body_type: vehicle?.body_type,
              make: vehicle?.make,
              model: vehicle?.model,
              colour: vehicle?.colour,
              plate: vehicle?.plate,
              seats: vehicle?.seats,
              accepts_luggage_runs: driver.accepts_luggage_runs,
            }}
          />
        </div>

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>

      <Link href="/settings/documents" className="dcard drow drow--solo">
        <span className="drow__ic" aria-hidden="true">
          <FileText size={19} strokeWidth={1.7} />
        </span>
        <span className="drow__t">
          <b>Its papers</b>
          <span>Carte grise and insurance live in Documents</span>
        </span>
      </Link>
    </>
  );
}
