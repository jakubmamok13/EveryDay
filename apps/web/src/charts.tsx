import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtDate } from "./api";

// Charts follow the dataviz method: one axis, 2px lines, hairline grid,
// crosshair tooltip listing every series, legend for 2+ series, table view.

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export interface Series {
  key: string;
  label: string;
  color: string; // CSS var
  values: (number | null)[];
}

export function LineChart({ dates, series, splitAt, height = 180, zeroLine, unit = "", ariaLabel }: {
  dates: string[];
  series: Series[];
  /** Index where the projection starts (drawn faded). */
  splitAt?: number;
  height?: number;
  zeroLine?: boolean;
  unit?: string;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 34, r: 12, t: 8, b: 22 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  let min = Math.min(...all, zeroLine ? 0 : Infinity);
  let max = Math.max(...all, zeroLine ? 0 : -Infinity);
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  const ticks = niceTicks(min, max);
  min = Math.min(min, ticks[0]!);
  max = Math.max(max, ticks[ticks.length - 1]!);
  const n = dates.length;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);
  const path = (vals: (number | null)[], from: number, to: number) => {
    let d = "";
    for (let i = from; i <= to && i < vals.length; i++) {
      const v = vals[i];
      if (v === null || v === undefined) continue;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    }
    return d;
  };
  const split = splitAt ?? n;
  const monthTicks = dates.map((d, i) => ({ d, i })).filter(({ d }, i) => d.endsWith("-01") || i === 0);
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };
  const lastIdx = (s: Series) => {
    for (let i = Math.min(split, n) - 1; i >= 0; i--) if (s.values[i] != null) return i;
    return -1;
  };
  return (
    <div ref={ref} className="relwrap">
      <svg className="chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 && zeroLine ? "base" : "grid"} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {monthTicks.map(({ d, i }) => (
          <text key={d} x={x(i)} y={height - 6} textAnchor="start">{MONTHS[Number(d.slice(5, 7)) - 1]}</text>
        ))}
        {split < n && <line className="grid" x1={x(split - 0.5)} x2={x(split - 0.5)} y1={pad.t} y2={height - pad.b} />}
        {series.map((s) => (
          <g key={s.key} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
            <path d={path(s.values, 0, split - 1)} stroke={`var(${s.color})`} />
            {split < n && <path d={path(s.values, split - 1, n - 1)} stroke={`var(${s.color})`} opacity={0.4} />}
          </g>
        ))}
        {(() => {
          const ends = series
            .map((s) => ({ s, i: lastIdx(s) }))
            .filter((e) => e.i >= 0)
            .map((e) => ({ ...e, v: e.s.values[e.i]! }));
          const ys = ends.map((e) => y(e.v)).sort((a, b) => a - b);
          // Colliding end labels are dropped; legend + tooltip carry the values.
          const collide = ys.some((v, k) => k > 0 && v - ys[k - 1]! < 13);
          return ends.map((e) => (
            <g key={e.s.key + "end"}>
              <circle cx={x(e.i)} cy={y(e.v)} r={4} fill={`var(${e.s.color})`} stroke="var(--surface)" strokeWidth={2} />
              {!collide && <text x={x(e.i) + 8} y={y(e.v) + 4} style={{ fill: "var(--ink-2)" }}>{Math.round(e.v)}{unit}</text>}
            </g>
          ));
        })()}
        {hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} />
            {series.map((s) => s.values[hover] != null && (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill={`var(${s.color})`} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={pad.l} y={0} width={width - pad.l - pad.r} height={height} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) - 60)), top: 0 }}>
          <div className="muted small">{fmtDate(dates[hover]!)}{hover >= split ? " · plan" : ""}</div>
          {series.map((s) => (
            <div key={s.key}><span className="k" style={{ background: `var(${s.color})` }} /><b>{s.values[hover] == null ? "—" : Math.round(s.values[hover]!)}{unit}</b> <span className="muted">{s.label}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items, projection }: { items: { label: string; color: string }[]; projection?: boolean }) {
  return (
    <div className="legend">
      {items.map((i) => <span key={i.label}><span className="key" style={{ background: `var(${i.color})` }} />{i.label}</span>)}
      {projection && <span><span className="key proj" style={{ background: "var(--ink-2)" }} />plan (prognoza)</span>}
    </div>
  );
}

export function ColumnChart({ labels, values, max, height = 140, unit = "", ariaLabel, describe }: {
  labels: string[];
  values: (number | null)[];
  max: number;
  height?: number;
  unit?: string;
  ariaLabel: string;
  describe: (i: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 34, r: 8, t: 16, b: 22 };
  const n = values.length;
  const band = (width - pad.l - pad.r) / n;
  const bw = Math.min(24, band - 4);
  const y = (v: number) => pad.t + (1 - v / (max || 1)) * (height - pad.t - pad.b);
  const ticks = niceTicks(0, max, 3);
  const last = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null).pop();
  return (
    <div ref={ref} className="relwrap">
      <svg className="chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "base" : "grid"} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}{unit}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = v === null ? y(0) : y(Math.max(0, v));
          const h = y(0) - top;
          const r = Math.min(4, h / 2);
          const x0 = cx - bw / 2;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} tabIndex={0}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={describe(i)}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={height - pad.t - pad.b} fill="transparent" />
              {v !== null && h > 0 && (
                <path d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${y(0)} Z`}
                  fill="var(--s-fitness)" opacity={hover === null || hover === i ? 1 : 0.55} />
              )}
              {(i === n - 1 || i % 3 === 2) && <text x={cx} y={height - 6} textAnchor="middle">{labels[i]}</text>}
            </g>
          );
        })}
        {last && last.v !== null && (
          <text x={pad.l + band * last.i + band / 2} y={y(last.v) - 4} textAnchor="middle" style={{ fill: "var(--ink-2)" }}>{Math.round(last.v)}{unit}</text>
        )}
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.min(width - 160, Math.max(0, pad.l + band * hover - 40)), top: 0 }}>{describe(hover)}</div>
      )}
    </div>
  );
}

export function TableToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="linkbtn" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Ukryj tabelę" : "Pokaż tabelę"}</button>
      {open && <div style={{ maxHeight: 240, overflow: "auto" }}>{children}</div>}
    </>
  );
}
