// Route-level loading UI: month navigation is a full server round-trip
// (force-dynamic), so show a quiet skeleton instead of a frozen stale grid.
export default function CalendarLoading() {
  return (
    <div aria-busy="true" aria-label="Loading calendar">
      <div className="dx-calskel__bar" style={{ width: 260 }} />
      <div className="dx-calskel__bar" style={{ width: "60%" }} />
      <div className="dx-calskel__grid">
        {Array.from({ length: 35 }, (_, i) => (
          <div className="dx-calskel__cell" key={i} />
        ))}
      </div>
    </div>
  );
}
