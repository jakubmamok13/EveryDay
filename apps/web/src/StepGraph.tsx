import { zoneClass } from "./api";

export interface DisplayStep {
  minutes: number;
  label: string;
  zone: number;
  indoor: string;
  outdoor: string;
  pct: number;
  pctHigh?: number;
  ramp?: boolean;
}

const ZONE_NAMES = ["", "Z1 Regeneracja", "Z2 Wytrzymałość", "Z3 Tempo", "Z4 Próg", "Z5 VO2max", "Z6 Beztlenowa", "Z7 Sprint"];

/** Workout profile: width = time, height = % FTP, shade = zone (validated ordinal ramp). */
export function StepGraph({ steps }: { steps: DisplayStep[] }) {
  const total = steps.reduce((s, x) => s + x.minutes, 0) || 1;
  const maxPct = Math.max(120, ...steps.map((s) => s.pctHigh ?? s.pct));
  const W = 600;
  const H = 96;
  let x = 0;
  return (
    <svg className="steps" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
      aria-label={`Profil treningu: ${steps.length} odcinków, ${Math.round(total)} minut`}>
      {steps.map((s, i) => {
        const w = (s.minutes / total) * W;
        const top = (p: number) => H - (p / maxPct) * H;
        const x0 = x + (i > 0 ? 1 : 0);
        const x1 = x + w - 1;
        x += w;
        const points = s.ramp && s.pctHigh !== undefined
          ? `${x0},${H} ${x0},${top(s.pct)} ${x1},${top(s.pctHigh)} ${x1},${H}`
          : `${x0},${H} ${x0},${top(s.pctHigh ?? s.pct)} ${x1},${top(s.pctHigh ?? s.pct)} ${x1},${H}`;
        return (
          <polygon key={i} points={points} className={zoneClass(s.zone)}>
            <title>{`${s.label || ZONE_NAMES[s.zone]} · ${s.minutes >= 1 ? `${Math.round(s.minutes)} min` : `${Math.round(s.minutes * 60)} s`} · ${s.indoor}`}</title>
          </polygon>
        );
      })}
    </svg>
  );
}

/** Collapse repeats for the readable step list ("3× 12 min Sweet Spot · 238–248 W"). */
export function StepList({ steps, outdoor }: { steps: DisplayStep[]; outdoor: boolean }) {
  const rows: { n: number; s: DisplayStep; pattern: DisplayStep[] }[] = [];
  let i = 0;
  while (i < steps.length) {
    // Detect a repeating pattern of length 1..8 starting at i.
    let best = { len: 1, n: 1 };
    for (let len = 1; len <= 8 && i + len * 2 <= steps.length; len++) {
      let n = 1;
      while (i + len * (n + 1) <= steps.length && steps.slice(i + len * n, i + len * (n + 1)).every((x, k) => same(x, steps[i + k]!))) n++;
      if (n > 1 && n * len > best.n * best.len) best = { len, n };
    }
    rows.push({ n: best.n, s: steps[i]!, pattern: steps.slice(i, i + best.len) });
    i += best.len * best.n;
  }
  const dur = (m: number) => (m >= 1 ? `${Math.round(m * 10) / 10} min` : `${Math.round(m * 60)} s`);
  return (
    <ul className="steplist">
      {rows.map((r, k) => (
        <li key={k}>
          <span className="muted">{r.n > 1 ? `${r.n}×` : dur(r.s.minutes)}</span>
          <span>
            {r.pattern.map((p, j) => (
              <span key={j} style={{ display: "block" }}>
                {r.n > 1 && <span className="muted">{dur(p.minutes)} </span>}
                {p.label || ZONE_NAMES[p.zone]}
              </span>
            ))}
          </span>
          <span style={{ textAlign: "right" }}>
            {r.pattern.map((p, j) => (
              <span key={j} className="zchip" style={{ display: "flex", justifyContent: "flex-end" }}>
                <i className={zoneClass(p.zone)} aria-hidden="true" />
                {outdoor ? p.outdoor : p.indoor}
                <span className="muted small">Z{p.zone}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function same(a: DisplayStep, b: DisplayStep): boolean {
  return a.minutes === b.minutes && a.pct === b.pct && a.pctHigh === b.pctHigh && a.label === b.label;
}
