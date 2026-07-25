// Route-level loading state for the Pool. Next shows this while the (force-dynamic)
// page awaits its Supabase query, so the screen carries the Pool's card SHAPE — a
// gentle pulsing skeleton — instead of flashing blank. Purely presentational (no
// data), so it renders instantly. Header subtitle + card count are placeholders.
function CardSkeleton({ delay }: { delay: number }) {
  const style = { animationDelay: `${delay}s` };
  return (
    <div className="pcard pcard--skel">
      <div className="pcard__head">
        <span className="pskel" style={{ width: 66, height: 20, ...style }} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <span className="pskel" style={{ width: 58, height: 10, ...style }} />
          <span className="pskel" style={{ width: 40, height: 13, ...style }} />
        </span>
      </div>
      <div className="pcard__body">
        <span className="pskel" style={{ width: 80, height: 21, borderRadius: 999, ...style }} />
        <div className="pskel-row">
          <span className="pskel-dot" style={style} />
          <span className="pskel" style={{ width: "60%", height: 12, ...style }} />
        </div>
        <div className="pskel-row">
          <span className="pskel-dot pskel-dot--ring" />
          <span className="pskel" style={{ width: "48%", height: 12, ...style }} />
        </div>
      </div>
      <div className="pcard__foot">
        <span className="pskel" style={{ width: "54%", height: 12, ...style }} />
      </div>
    </div>
  );
}

export default function PoolLoading() {
  return (
    <>
      <div className="pool-head">
        <div>
          <h1 className="pool-head__title">Pool</h1>
          <span className="pskel" style={{ width: 172, height: 11, marginTop: 6 }} />
        </div>
      </div>
      {[0, 0.15, 0.3].map((delay, i) => (
        <CardSkeleton key={i} delay={delay} />
      ))}
    </>
  );
}
