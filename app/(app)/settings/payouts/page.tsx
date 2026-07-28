import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getAppContext } from "@/lib/app-context";
import { SettingsHeader } from "@/components/settings-header";

export const dynamic = "force-dynamic";

// Honest stub. Payments are a DEFERRED integration (the founder green-lights the
// integration phase); in beta every euro settles manually. Saying so is better than
// a dead button that implies otherwise.
export default async function PayoutsPage() {
  const ctx = await getAppContext();
  if (!ctx.driver) redirect("/onboarding");
  const driver = ctx.driver;

  return (
    <>
      <SettingsHeader title="Payouts" />

      <div className="dcard">
        <p className="dcard__label">Status</p>
        <p className="dset__body">
          {driver.stripe_account_id
            ? "Connected — payouts are set up."
            : "Not connected yet. During the beta we settle every trip with you directly, and we’ll tell you before that changes."}
        </p>
        <button className="btn secondary" type="button" disabled>
          Set up payouts with Stripe — coming soon
        </button>
      </div>

      <div className="dlock dlock--foot" style={{ marginTop: 0 }}>
        <Lock size={15} strokeWidth={1.9} aria-hidden="true" />
        <span>
          Bank details are collected by Stripe, never by us. Kavenue stores no IBAN and
          no card.
        </span>
      </div>
    </>
  );
}
