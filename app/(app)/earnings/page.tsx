// Earnings — the new fourth tab. Placeholder for now: the full screen (earned
// this week / month, per-trip breakdown, payouts) gets its own D25 design pass.
// Payouts settle manually in beta (Stripe deferred), so this stays honest.
export const dynamic = "force-dynamic";

export default function EarningsPage() {
  return (
    <>
      <div className="pool-head">
        <div>
          <h1 className="pool-head__title">Earnings</h1>
          <div className="pool-head__sub">Your completed trips and payouts</div>
        </div>
      </div>

      <div className="empty">
        Earnings are coming soon.
        <br />
        Your completed trips and weekly payouts will show here.
      </div>
    </>
  );
}
