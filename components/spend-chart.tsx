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
 * columns); a hundred lines of scale maths is the cheaper trade in an app whose
 * whole dependency list is Supabase, Geist and Lucide.
 *
 * ⚑ ONLY GEOMETRY LIVES IN THE SVG. The viewBox is stretched with
 * preserveAspectRatio="none" so the bars keep their proportions at any width
 * with no measure-then-draw pass — but that transform is non-uniform, and it
 * stretched the TEXT too: on the 1520px layout every axis label rendered ~47 %
 * wider than tall. Labels are now HTML in an overlay positioned in percentages,
 * so type stays type.
 */
const W = 1000;
const H = 220;
const ML = 52;
const MR = 10;
const MT = 16;
const MB = 28;
const IW = W - ML - MR;
const IH = H - MT - MB;
/** The plot area as a CSS percentage — the overlay must track the stretched SVG. */
const PAD_L = (ML / W) * 100;

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
  /**
   * The comparison period, drawn as a paler bar beside each one. The PAGE passes
   * null when comparison is off or when the previous period holds nothing, and
   * gates its own legend and footnote on the same value — so the chart can never
   * be described as showing a series it doesn't draw.
   */
  compare: SeriesPoint[] | null;
  compareLabel: string | null;
  /** Where clicking a bucket goes. Null makes the bars inert. */
  hrefFor: ((p: SeriesPoint) => string) | null;
  periodLabel: string;
}) {
  if (points.length === 0) return null;

  const paired = Boolean(compare && compare.length > 0);
  const peak = Math.max(...points.map((p) => p.amount), ...(compare ?? []).map((p) => p.amount), 0);
  const ticks = niceTicks(peak);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => MT + IH - (v / top) * IH;
  const bw = IW / points.length;

  const gap = paired ? Math.min(3, bw * 0.06) : 0;
  const bar = paired
    ? Math.max(2, Math.min((bw * 0.72 - gap) / 2, 22))
    : Math.max(2, Math.min(bw * 0.56, 34));

  /**
   * ⚑ Aligned by POSITION, not by a scaled index.
   *
   * This was `compare[floor(i * compare.length / points.length)]`, which for any
   * mismatched pair silently repeated some comparison buckets and dropped
   * others — March against February drew 1, 10 and 19 February TWICE, inflating
   * the pale series by those three days; February against January never drew
   * 11 January at all. Day 1 now sits beside day 1, and a current period longer
   * than its comparison simply has nothing beside its last bars, which is true.
   */
  const prevAt = (i: number) => compare?.[i]?.amount ?? 0;

  const xNow = (i: number) => ML + i * bw + bw / 2 - (paired ? bar + gap / 2 : bar / 2);
  const xPrev = (i: number) => ML + i * bw + bw / 2 + gap / 2;
  const pct = (x: number) => (x / W) * 100;

  /** How much of a bucket the bars occupy — the hover wash is inset to match. */
  const bandPct = ((paired ? 2 * bar + gap : bar) / bw) * 100;

  const peakIndex = points.reduce((best, p, i) => (p.amount > points[best].amount ? i : best), 0);
  const labelAll = points.length <= 10;
  const stride = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="dxs-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="dxs-chart__svg"
        role="img"
        aria-label={`Spend across ${periodLabel}, peaking at ${formatMoney(points[peakIndex].amount)}.${
          paired && compareLabel ? ` Each bar is paired with a paler one for ${compareLabel}.` : ""
        }`}
      >
        {ticks.map((t) => (
          <line key={t} x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} className="dxs-chart__grid" />
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
              />
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
            />
          );
        })}

        <line x1={ML} x2={W - MR} y1={MT + IH} y2={MT + IH} className="dxs-chart__axis" />
      </svg>

      {/* ---- text, in HTML so the stretch can't reach it --------------------- */}
      <div className="dxs-chart__labels" aria-hidden="true">
        {ticks.map((t) => (
          <span
            key={`y-${t}`}
            className="dxs-chart__ytick"
            style={{ top: y(t), right: `${100 - PAD_L}%` }}
          >
            {short(t)}
          </span>
        ))}

        {labelAll
          ? points.map((p, i) =>
              p.amount > 0 ? (
                <span
                  key={`v-${p.key}`}
                  className="dxs-chart__val"
                  style={{ left: `${pct(xNow(i) + bar / 2)}%`, top: y(p.amount) - 16 }}
                >
                  {formatMoney(p.amount)}
                </span>
              ) : null,
            )
          : points[peakIndex].amount > 0 && (
              <span
                className="dxs-chart__peak"
                style={{
                  left: `${pct(xNow(peakIndex) + bar / 2)}%`,
                  top: y(points[peakIndex].amount) - 16,
                }}
              >
                Highest · {formatMoney(points[peakIndex].amount)}
              </span>
            )}

        {points.map((p, i) =>
          i % stride === 0 ? (
            <span
              key={`x-${p.key}`}
              className="dxs-chart__xtick"
              style={{ left: `${pct(ML + i * bw + bw / 2)}%`, top: H - MB + 7 }}
            >
              {p.label}
            </span>
          ) : null,
        )}
      </div>

      {/* Click targets: real links, keyboard-reachable, and they carry the
          tooltip — the bars sit UNDER this layer, so a <title> on a <rect> would
          never fire. */}
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
