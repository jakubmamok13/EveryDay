import { useState } from "react";
import { api, fmtDate, fmtMinutes } from "./api";
import { Card, Seg, useAction, useToast } from "./ui";

// Research features on Today (docs/10, D-049 …): A1, A4, B1, B2, C4, D1–D3.

const MODES = [
  { value: "indoor" as const, label: "W domu" },
  { value: "outdoor" as const, label: "Na zewnątrz" },
];
const pct = (x: number | null | undefined) => (x == null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);

/** A1: green light for an extra ride on a rest day. */
export function BonusOfferCard({ offer, defaultMode, setT }: { offer: any; defaultMode: "indoor" | "outdoor"; setT: (t: any) => void }) {
  const [mode, setMode] = useState<"indoor" | "outdoor">(defaultMode);
  const { busy, run } = useAction();
  return (
    <Card title="🟢 Zielone światło: możesz dziś dorzucić jazdę" className="offer">
      <ul className="small reasons">{offer.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
      <Seg text label="Gdzie" value={mode} options={MODES} onChange={setMode} />
      <div className="stack" style={{ marginTop: 10 }}>
        {offer.options.map((o: any) => (
          <button key={`${o.slug}-${o.minutes}`} className="btn block option" disabled={busy}
            onClick={() => run(async () => setT(await api.post("/api/bonus/accept", { slug: o.slug, minutes: o.minutes, rideMode: mode })), "Dodano jazdę i wysłano na urządzenia.")}>
            <span className="opt-name">{o.name} · {fmtMinutes(o.minutes)}</span>
            {o.impact && (
              <span className="opt-impact">Forma w {fmtDate(o.impact.date)} ({o.impact.name}): {pct(o.impact.formBefore)} → {pct(o.impact.formAfter)}</span>
            )}
          </button>
        ))}
      </div>
      <button className="linkbtn" disabled={busy} onClick={() => run(async () => setT(await api.post("/api/bonus/dismiss")))}>Nie dziś</button>
    </Card>
  );
}

/** A4: tomorrow's hard day starts with low Form. */
export function TomorrowCard({ w, setT }: { w: any; setT: (t: any) => void }) {
  const { busy, run } = useAction();
  const toast = useToast();
  const act = (a: string) => run(async () => {
    const r = await api.post(`/api/tomorrow/${a}`);
    toast(r.message);
    setT(r);
  });
  return (
    <Card title={w.level === "red" ? "🔴 Jutro: raczej odpoczynek" : "🟡 Jutro: uważaj"} className={`tomorrow ${w.level}`}>
      <p className="small" style={{ marginTop: 0 }}>{w.text}</p>
      <div className="row">
        <button className="btn small primary" disabled={busy} onClick={() => act("easier")}>Lżej jutro</button>
        {w.canMove && <button className="btn small" disabled={busy} onClick={() => act("move")}>Przesuń na {fmtDate(w.dayAfter)}</button>}
        <button className="btn small ghost" disabled={busy} onClick={() => act("dismiss")}>Zostaw plan</button>
      </div>
    </Card>
  );
}

/** B1: how hard today's workout is for this athlete. */
export function ChallengeChip({ c }: { c: any }) {
  if (!c) return null;
  return (
    <span className={`tag challenge ${c.key}`} title={`Twój poziom ${c.category}: ${c.athleteLevel} z ${c.max}; ten trening: ${c.workoutLevel}`}>
      {c.label} · poziom {c.workoutLevel}/{c.max}
    </span>
  );
}

const EFFORTS = [
  { value: "easy", label: "Łatwo" },
  { value: "moderate", label: "Umiarkowanie" },
  { value: "hard", label: "Ciężko" },
  { value: "very_hard", label: "Bardzo ciężko" },
  { value: "all_out", label: "Na maksa" },
] as const;
const COMPLETED = [
  { value: "yes" as const, label: "Całość" },
  { value: "partial" as const, label: "Częściowo" },
  { value: "no" as const, label: "Nie" },
];

/** B2: 5-step rating + "did you finish?" */
export function RideRatingCard({ ride, onDone }: { ride: any; onDone: (t: any) => void }) {
  const [completed, setCompleted] = useState<"yes" | "partial" | "no">("yes");
  const { busy, run } = useAction();
  return (
    <Card title={`Jak było? · ${fmtDate(ride.date)}`}>
      <p className="small" style={{ marginTop: 0 }}>{ride.name} · {fmtMinutes(ride.minutes)}{ride.compliance != null ? ` · wykonanie ${Math.round(ride.compliance)}%` : ""}</p>
      <div className="small muted">Ukończone interwały</div>
      <Seg text label="Ukończone" value={completed} options={COMPLETED} onChange={setCompleted} />
      <div className="small muted" style={{ marginTop: 8 }}>Jak ciężko było?</div>
      <div className="efforts">
        {EFFORTS.map((e) => (
          <button key={e.value} className="btn small" disabled={busy}
            onClick={() => run(async () => onDone(await api.post(`/api/rides/${ride.id}/rating`, { effort: e.value, completed })), "Dzięki!")}>{e.label}</button>
        ))}
      </div>
    </Card>
  );
}

/** D1: carbohydrate for the day. */
export function CarbsCard({ c }: { c: any }) {
  if (!c) return null;
  return (
    <Card title="Jedzenie dziś">
      <p className="small" style={{ margin: 0 }}>🍝 {c.text}</p>
      <p className="tiny muted" style={{ marginBottom: 0 }}>Według ACSM 2016 (zalecenia dla sportowców). Bez diet i odchudzania.</p>
    </Card>
  );
}

/** D2: heat acclimation before a hot event. */
export function HeatCard({ h }: { h: any }) {
  if (!h) return null;
  return (
    <Card title="☀️ Aklimatyzacja do upału">
      <p className="small" style={{ marginTop: 0 }}>{h.text}</p>
      <div className="meter small-meter" role="meter" aria-valuemin={0} aria-valuemax={h.target} aria-valuenow={h.sessions} aria-label="Sesje w cieple">
        <div className="fill" style={{ width: `${Math.min(100, (h.sessions / h.target) * 100)}%` }} />
      </div>
      <p className="tiny muted" style={{ marginBottom: 0 }}>{h.optional}</p>
    </Card>
  );
}

/** D3: Monday summary of last week (+ stagnation). */
export function SummaryCard({ s, setT }: { s: any; setT: (t: any) => void }) {
  const { busy, run } = useAction();
  return (
    <Card title={`Podsumowanie tygodnia od ${fmtDate(s.weekStart)}`}>
      {s.lines.map((l: string, i: number) => <p key={i} className="small" style={{ margin: "4px 0" }}>{l}</p>)}
      {s.stagnation && (
        <div className="stagnation">
          <p className="small"><strong>Zastój:</strong> {s.stagnation.text}</p>
          {s.stagnation.action === "hit_block" && (
            <button className="btn small primary" disabled={busy} onClick={() => run(async () => { await api.post("/api/plan/hit-block", { on: true }); setT(await api.post("/api/summary/dismiss")); }, "Zaplanowano blok interwałowy.")}>Zaplanuj blok interwałowy</button>
          )}
        </div>
      )}
      <button className="linkbtn" disabled={busy} onClick={() => run(async () => setT(await api.post("/api/summary/dismiss")))}>OK</button>
    </Card>
  );
}

/** C4: gentle return after a break. */
export function ComebackCard({ c }: { c: any }) {
  if (!c) return null;
  return (
    <Card title="🔄 Powrót po przerwie">
      <p className="small" style={{ margin: 0 }}>{c.text}</p>
    </Card>
  );
}
