/**
 * The skeleton mirrors the real geometry — hero figure, the service strip and the
 * chart's exact height — so the page doesn't jump when the numbers land. A total
 * sitting there looking final while it's actually stale is the failure this
 * prevents (§ T: production is ~2 s cold, and the cause is a serverless cold
 * start, not the query count).
 */
export default function Loading() {
  return (
    <>
      <div className="dxs-head">
        <div>
          <h1 className="dset__h1">Spend</h1>
          <p className="dset__sub">Adding it up…</p>
        </div>
      </div>

      <div className="dxs-sk dxs-sk--tools dx-pulse" />

      <div className="dcard dxs-hero">
        <div className="dxs-hero__main">
          <div className="dxs-sk dxs-sk--label dx-pulse" />
          <div className="dxs-sk dxs-sk--total dx-pulse" />
          <div className="dxs-sk dxs-sk--sub dx-pulse" />
          <div className="dxs-sk dxs-sk--pill dx-pulse" />
        </div>
        <div className="dxs-hero__stats">
          <div className="dxs-stat">
            <div className="dxs-sk dxs-sk--sub dx-pulse" />
            <div className="dxs-sk dxs-sk--stat dx-pulse" />
          </div>
          <div className="dxs-stat">
            <div className="dxs-sk dxs-sk--sub dx-pulse" />
            <div className="dxs-sk dxs-sk--stat dx-pulse" />
          </div>
        </div>
      </div>

      <div className="dxs-serv">
        <div className="dxs-sk dxs-sk--serv dx-pulse" />
      </div>

      {/* ⚑ No chart block. The skeleton can't read searchParams, so it can't
          know whether the page it precedes will render a chart — and the day
          view (reached by clicking a column, the primary route into it) never
          does. Reserving 270px for a card that doesn't arrive is a worse jump
          than not reserving it. The cards below still hold the page's shape. */}

      <div className="dxs-band">
        <div className="dcard">
          <div className="dxs-sk dxs-sk--label dx-pulse" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dxs-sk dxs-sk--row dx-pulse" />
          ))}
        </div>
        <div className="dcard">
          <div className="dxs-sk dxs-sk--label dx-pulse" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="dxs-sk dxs-sk--row dx-pulse" />
          ))}
        </div>
      </div>
    </>
  );
}
