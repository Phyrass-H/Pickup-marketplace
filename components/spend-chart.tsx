import type React from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { SeriesPoint } from "@/lib/spend";

/**
 * Spend over time — hand-rolled SVG, rendered on the server.
 *
 * ⚑ No charting library, on purpose. Recharts is ~147 KB gzipped, ships its own
 * state runtime and forces `'use client'`, so nothing would server-render and
 * the chart would flash in after hydration. This page needs one form (paired
 * columns); eighty lines of scale maths is the cheaper trade in an app whose
 * whole dependency list is Supabase, Geist and Lucide.
 *
 * The geometry is a fixed viewBox scaled by CSS: the bars keep their proportions
 * at any width, and there is no measure-then-draw pass.
 *
 * Every column is a link that narrows the page to its own bucket — a chart you
 * can only look at is a poster, not a tool.
 */
const W = 1000;
const H = 220;
const ML = 52;
const MR = 10;
const MT = 16;
const MB = 28;
const IW = W - ML - MR;
const IH = H - MT - MB;

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const step = Math.pow(10, Math.floor(Math.log10(max / 3 || 1)));
  const size = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= 4) ?? step * 10;
  const out: number[] = [];
  for (let v = 0; v <= max + size * 0.001; v += size) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + size);
  return out;
}

const short = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}k` : String(Math.round(n));

export function SpendChart({
  points,
  compare,
  compareLabel,
  hrefFor,
  periodLabel,
}: {
  points: SeriesPoint[];
  /** The comparison period, drawn as a paler bar beside each one. Null = off. */
  compare: SeriesPoint[] | null;
  compareLabel: string | null;
  /** Where clicking a bucket goes. Null makes the bars inert. */
  hrefFor: ((p: SeriesPoint) => string) | null;
  periodLabel: string;
}) {
  if (points.length === 0) return null;

  const peak = Math.max(
    ...points.map((p) => p.amount),
    ...(compare ?? []).map((p) => p.amount),
    0,
  );
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => MT + IH - (v / top) * IH;
  const bw = IW / points.length;

  /**
   * ⚑ The comparison is a SECOND BAR, not a line behind the bars.
   *
   * It was a grey step line, and the founder's reaction says everything about
   * why that failed: *"oh I got it, the grey steps was previous period, I did
   * [not] get what it was."* Two colours were already there — the problem was
   * two different SHAPES. A line and a bar don't read as two of the same thing,
   * so the eye has to be told what the line is instead of just seeing it.
   *
   * Paired bars need no legend to be understood. The widest case we ever render
   * is a 31-day month, and this chart sits on the 1520px layout, so each bucket
   * gets ~46px — two comfortable bars with a gap, not the thin forest you'd get
   * on a narrow card.
   */
  const paired = Boolean(compare && compare.length > 0 && compare.some((p) => p.amount > 0));
  const gap = paired ? Math.min(3, bw * 0.06) : 0;
  const bar = paired
    ? Math.max(2, Math.min((bw * 0.72 - gap) / 2, 22))
    : Math.max(2, Math.min(bw * 0.56, 34));

  // Stretched onto THIS period's bucket count, so a 30-day month laid against a
  // 31-day one still lines up week for week.
  const prevAt = (i: number) => {
    if (!compare || compare.length === 0) return 0;
    const scale = compare.length / points.length;
    return compare[Math.min(compare.length - 1, Math.floor(i * scale))]?.amount ?? 0;
  };
  const xNow = (i: number) => ML + i * bw + bw / 2 - (paired ? bar + gap / 2 : bar / 2);
  const xPrev = (i: number) => ML + i * bw + bw / 2 + gap / 2;

  /**
   * ⚑ How much of a bucket the bars actually occupy, as a percentage — handed to
   * CSS so the hover wash is exactly as wide as what it highlights.
   *
   * It was hard-coded at 72%, which is only right when the bar width is driven
   * by the bucket. `bar` is CAPPED at 22 units so a sparse chart doesn't grow
   * fat bars — and the moment that cap bites (a week view, a year view, and most
   * of all a single-bucket day), the bars stop filling their 72% while the wash
   * carried on covering it. A day view highlighted most of the chart.
   */
  const bandPct = ((paired ? 2 * bar + gap : bar) / bw) * 100;

  const peakIndex = points.reduce((best, p, i) => (p.amount > points[best].amount ? i : best), 0);
  // ⚑ With few enough buckets every bar can carry its own figure, which is what
  // the founder actually wanted ("hard to understand the amount at a glance").
  // Past ~10 the labels start colliding, so only the highest keeps one — and it
  // says "Highest" now, because an unexplained lone number on a SPEND chart got
  // read as "best revenue", which is the opposite of what it means.
  const labelAll = points.length <= 10;
  // Enough x labels to orient, never so many they collide.
  const stride = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="dxs-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="dxs-chart__svg"
        role="img"
        aria-label={`Spend across ${periodLabel}, peaking at ${formatMoney(points[peakIndex].amount)}.${compareLabel ? ` Each bar is paired with a paler one for ${compareLabel}.` : ""}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} className="dxs-chart__grid" />
            <text x={ML - 10} y={y(t) + 4} textAnchor="end" className="dxs-chart__ytick">
              {short(t)}
            </text>
          </g>
        ))}

        {/* The previous period first, so a current bar never hides behind it. */}
        {paired &&
          points.map((p, i) => {
            const v = prevAt(i);
            if (v <= 0) return null;
            return (
              <rect
                key={`prev-${p.key}`}
                x={xPrev(i)}
                y={y(v)}
                width={bar}
                height={Math.max(2, MT + IH - y(v))}
                rx={1.5}
                className="dxs-chart__bar dxs-chart__bar--prev"
              >
                <title>{`${compareLabel ?? "Previous period"} · ${formatMoney(v)}`}</title>
              </rect>
            );
          })}

        {points.map((p, i) => {
          const h = Math.max(p.amount > 0 ? 2 : 0, MT + IH - y(p.amount));
          if (h === 0) return null;
          return (
            <rect
              key={p.key}
              x={xNow(i)}
              y={y(p.amount)}
              width={bar}
              height={h}
              rx={1.5}
              className="dxs-chart__bar"
            >
              <title>{`${p.label} · ${formatMoney(p.amount)} · ${p.trips} trip${p.trips === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}

        {labelAll
          ? points.map((p, i) =>
              p.amount > 0 ? (
                <text
                  key={`v-${p.key}`}
                  x={xNow(i) + bar / 2}
                  y={y(p.amount) - 7}
                  textAnchor="middle"
                  className="dxs-chart__val"
                >
                  {formatMoney(p.amount)}
                </text>
              ) : null,
            )
          : points[peakIndex].amount > 0 && (
              <text
                x={xNow(peakIndex) + bar / 2}
                y={y(points[peakIndex].amount) - 7}
                textAnchor="middle"
                className="dxs-chart__peak"
              >
                Highest · {formatMoney(points[peakIndex].amount)}
              </text>
            )}

        <line x1={ML} x2={W - MR} y1={MT + IH} y2={MT + IH} className="dxs-chart__axis" />
        {points.map((p, i) =>
          i % stride === 0 ? (
            <text
              key={`x-${p.key}`}
              x={ML + i * bw + bw / 2}
              y={H - 9}
              textAnchor="middle"
              className="dxs-chart__xtick"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      {/* The click targets live outside the SVG so they are real links — keyboard
          reachable, focusable, and they survive with JavaScript disabled.
          ⚑ They also OCCLUDE the bars, which is why each <rect>'s own <title>
          never fired: the pointer was always on this layer, not on the bar. The
          tooltip lives here instead, and the hover wash is inset to the width of
          the two bars rather than the whole bucket + its gutters. */}
      {hrefFor && (
        <div
          className="dxs-chart__hit"
          style={
            {
              gridTemplateColumns: `repeat(${points.length}, 1fr)`,
              "--dxs-band": `${bandPct.toFixed(3)}%`,
            } as React.CSSProperties
          }
        >
          {points.map((p, i) => {
            const was = paired ? prevAt(i) : null;
            return (
              <Link
                key={`hit-${p.key}`}
                href={hrefFor(p)}
                scroll={false}
                className="dxs-chart__cell"
                aria-label={`${p.full}: ${formatMoney(p.amount)}, ${p.trips} trip${p.trips === 1 ? "" : "s"}. Narrow to this period.`}
              >
                <span className="dxs-tip" aria-hidden="true">
                  <b>{p.full}</b>
                  <span className="dxs-tip__row">
                    <i className="dxs-tip__sw dxs-tip__sw--now" />
                    {formatMoney(p.amount)}
                    <em>
                      {p.trips} trip{p.trips === 1 ? "" : "s"}
                    </em>
                  </span>
                  {was != null && (
                    <span className="dxs-tip__row dxs-tip__row--prev">
                      <i className="dxs-tip__sw dxs-tip__sw--prev" />
                      {formatMoney(was)}
                      <em>{compareLabel}</em>
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
