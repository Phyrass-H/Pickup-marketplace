import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { SeriesPoint } from "@/lib/spend";

/**
 * Spend over time — hand-rolled SVG, rendered on the server.
 *
 * ⚑ No charting library, on purpose. Recharts is ~147 KB gzipped, ships its own
 * state runtime and forces `'use client'`, so nothing would server-render and
 * the chart would flash in after hydration. This page needs exactly two forms
 * (columns + a step line); eighty lines of scale maths is the cheaper trade in
 * an app whose whole dependency list is Supabase, Geist and Lucide.
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
  /** The comparison period, drawn behind as a grey step line. Null = off. */
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
  const bar = Math.max(2, Math.min(bw * 0.56, 34));

  // The comparison is stretched onto THIS period's bucket count, so a 30-day
  // month laid over a 31-day one still lines up week for week.
  let stepPath = "";
  if (compare && compare.length > 0 && compare.some((p) => p.amount > 0)) {
    const scale = compare.length / points.length;
    for (let i = 0; i < points.length; i += 1) {
      const v = compare[Math.min(compare.length - 1, Math.floor(i * scale))]?.amount ?? 0;
      const x0 = ML + i * bw;
      const x1 = ML + (i + 1) * bw;
      stepPath += `${i === 0 ? "M" : "L"}${x0.toFixed(1)} ${y(v).toFixed(1)}L${x1.toFixed(1)} ${y(v).toFixed(1)}`;
    }
  }

  const peakIndex = points.reduce((best, p, i) => (p.amount > points[best].amount ? i : best), 0);
  // Enough x labels to orient, never so many they collide.
  const stride = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="dxs-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="dxs-chart__svg"
        role="img"
        aria-label={`Spend per ${points.length > 20 ? "day" : "bucket"} across ${periodLabel}, peaking at ${formatMoney(points[peakIndex].amount)}.${compareLabel ? ` The grey line behind is ${compareLabel}.` : ""}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} className="dxs-chart__grid" />
            <text x={ML - 10} y={y(t) + 4} textAnchor="end" className="dxs-chart__ytick">
              {short(t)}
            </text>
          </g>
        ))}

        {stepPath && <path d={stepPath} className="dxs-chart__prev" />}

        {points.map((p, i) => {
          const h = Math.max(p.amount > 0 ? 2 : 0, MT + IH - y(p.amount));
          if (h === 0) return null;
          const x = ML + i * bw + (bw - bar) / 2;
          return (
            <rect
              key={p.key}
              x={x}
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

        {points[peakIndex].amount > 0 && (
          <text
            x={ML + peakIndex * bw + bw / 2}
            y={y(points[peakIndex].amount) - 7}
            textAnchor="middle"
            className="dxs-chart__peak"
          >
            {formatMoney(points[peakIndex].amount)}
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
          reachable, focusable, and they survive with JavaScript disabled. */}
      {hrefFor && (
        <div className="dxs-chart__hit" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
          {points.map((p) => (
            <Link
              key={`hit-${p.key}`}
              href={hrefFor(p)}
              scroll={false}
              className="dxs-chart__cell"
              aria-label={`${p.label}: ${formatMoney(p.amount)}, ${p.trips} trip${p.trips === 1 ? "" : "s"}. Narrow to this period.`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
