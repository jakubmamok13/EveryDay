import { WEEKDAYS } from "./api";

// Shared editors for goals and availability (onboarding + settings).

export interface GoalForm {
  primary: "raise_ftp" | "endurance" | "event" | "general_fitness";
  secondary: "" | "raise_ftp" | "endurance" | "general_fitness";
  targetKm: number;
  targetHours: number;
  eventName: string;
  eventDate: string;
  priority: "A" | "B" | "C";
}

export const GOAL_LABEL: Record<string, string> = {
  raise_ftp: "Podnieść FTP",
  endurance: "Długie jazdy",
  event: "Start / wydarzenie w terminie",
  general_fitness: "Ogólna forma i zdrowie",
};

export function goalsToApi(g: GoalForm) {
  const out: any[] = [];
  out.push(g.primary === "event"
    ? { role: "primary", type: "event", eventName: g.eventName, eventDate: g.eventDate, priority: g.priority }
    : g.primary === "endurance"
      ? { role: "primary", type: "endurance", targetDistanceKm: g.targetKm, targetMinutes: Math.round(g.targetHours * 60) }
      : { role: "primary", type: g.primary });
  if (g.secondary && g.secondary !== g.primary) {
    out.push(g.secondary === "endurance"
      ? { role: "secondary", type: "endurance", targetDistanceKm: g.targetKm, targetMinutes: Math.round(g.targetHours * 60) }
      : { role: "secondary", type: g.secondary });
  }
  return out;
}

export function goalsFromApi(goals: any[]): GoalForm {
  const p = goals.find((g) => g.role === "primary");
  const s = goals.find((g) => g.role === "secondary");
  const end = goals.find((g) => g.type === "endurance");
  return {
    primary: p?.type ?? "raise_ftp",
    secondary: s?.type ?? "",
    targetKm: end?.targetDistanceKm ?? 200,
    targetHours: end?.targetMinutes ? end.targetMinutes / 60 : 7,
    eventName: p?.eventName ?? "",
    eventDate: p?.eventDate ?? "",
    priority: p?.priority ?? "A",
  };
}

export function GoalEditor({ g, set }: { g: GoalForm; set: (g: GoalForm) => void }) {
  const showTarget = g.primary === "endurance" || g.secondary === "endurance";
  return (
    <>
      <label className="field"><span>Cel główny</span>
        <select value={g.primary} onChange={(e) => set({ ...g, primary: e.target.value as GoalForm["primary"] })}>
          {Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {g.primary === "event" && (
        <>
          <label className="field"><span>Nazwa wydarzenia</span><input value={g.eventName} onChange={(e) => set({ ...g, eventName: e.target.value })} /></label>
          <label className="field"><span>Data</span><input type="date" value={g.eventDate} onChange={(e) => set({ ...g, eventDate: e.target.value })} /></label>
        </>
      )}
      <label className="field"><span>Cel dodatkowy (opcjonalnie)</span>
        <select value={g.secondary} onChange={(e) => set({ ...g, secondary: e.target.value as GoalForm["secondary"] })}>
          <option value="">— brak —</option>
          {Object.entries(GOAL_LABEL).filter(([k]) => k !== "event" && k !== g.primary).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {showTarget && (
        <div className="row">
          <label className="field" style={{ flex: 1 }}><span>Dystans (km)</span><input type="number" inputMode="numeric" value={g.targetKm} onChange={(e) => set({ ...g, targetKm: Number(e.target.value) })} /></label>
          <label className="field" style={{ flex: 1 }}><span>Czas (h)</span><input type="number" inputMode="decimal" step={0.5} value={g.targetHours} onChange={(e) => set({ ...g, targetHours: Number(e.target.value) })} /></label>
        </div>
      )}
    </>
  );
}

export interface DayForm {
  weekday: number;
  available: boolean;
  maxMinutes: number;
  defaultRideMode: "indoor" | "outdoor";
  notifyTime: string;
}

export function AvailabilityEditor({ days, set, showTimes }: { days: DayForm[]; set: (d: DayForm[]) => void; showTimes?: boolean }) {
  const upd = (i: number, patch: Partial<DayForm>) => set(days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div>
      {days.map((d, i) => (
        <div key={d.weekday} className="row" style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : "0" }}>
          <label className="check" style={{ width: 82 }}>
            <input type="checkbox" checked={d.available} onChange={(e) => upd(i, { available: e.target.checked, maxMinutes: e.target.checked && !d.maxMinutes ? 60 : d.maxMinutes })} />
            {WEEKDAYS[d.weekday]}
          </label>
          {d.available ? (
            <>
              <select aria-label={`Czas ${WEEKDAYS[d.weekday]}`} value={d.maxMinutes} onChange={(e) => upd(i, { maxMinutes: Number(e.target.value) })} style={{ minHeight: 40, borderRadius: 10 }}>
                {[30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300, 360].map((m) => <option key={m} value={m}>{m < 90 ? `${m} min` : `${m / 60} h`}</option>)}
              </select>
              <select aria-label={`Gdzie ${WEEKDAYS[d.weekday]}`} value={d.defaultRideMode} onChange={(e) => upd(i, { defaultRideMode: e.target.value as DayForm["defaultRideMode"] })} style={{ minHeight: 40, borderRadius: 10 }}>
                <option value="indoor">W domu</option>
                <option value="outdoor">Na zewnątrz</option>
              </select>
            </>
          ) : <span className="muted small">wolne</span>}
          {showTimes && (
            <input type="time" aria-label={`Powiadomienie ${WEEKDAYS[d.weekday]}`} value={d.notifyTime} onChange={(e) => upd(i, { notifyTime: e.target.value })} style={{ minHeight: 40, borderRadius: 10, marginLeft: "auto" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export const DEFAULT_DAYS: DayForm[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  available: [1, 3, 6, 7].includes(weekday),
  maxMinutes: weekday === 1 || weekday === 3 ? 60 : weekday >= 6 ? 240 : 0,
  defaultRideMode: weekday >= 6 ? "outdoor" : "indoor",
  notifyTime: "07:00",
}));
