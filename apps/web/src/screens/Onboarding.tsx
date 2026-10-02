import { useState } from "react";
import { PAIN_PARTS } from "@everyday/core";
import { api } from "../api";
import { AvailabilityEditor, DEFAULT_DAYS, GoalEditor, goalsToApi, type DayForm, type GoalForm } from "../forms";
import { InstallHint, ReminderGuide } from "../reminder";
import { setMode } from "../runtime";
import { Card, useAction, useToast } from "../ui";

const STEPS = ["Start", "Profil", "Cele", "Tydzień", "Długie jazdy", "Sprzęt", "Zdrowie", "Przypomnienie", "Gotowe"];
const EQUIPMENT = [
  { key: "trainer", label: "Trenażer smart (MyWhoosh)" },
  { key: "computer", label: "Licznik rowerowy (np. Wahoo)" },
  { key: "watch", label: "Zegarek (HRV, sen, Body Battery)" },
  { key: "hr", label: "Pas HR" },
  { key: "pm", label: "Miernik mocy na rowerze" },
] as const;
type EquipKey = (typeof EQUIPMENT)[number]["key"];
const TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00", "09:00"];

export function Onboarding({ demo, onDone }: { demo: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [profile, setProfile] = useState({ weightKg: 75, heightCm: 178, ftp: 220, lthr: 0, maxHr: 0 });
  const [goals, setGoals] = useState<GoalForm>({ primary: "raise_ftp", secondary: "endurance", targetKm: 150, targetHours: 5.5, eventName: "", eventDate: "", priority: "A" });
  const [days, setDays] = useState<DayForm[]>(DEFAULT_DAYS);
  const [longRides, setLongRides] = useState({ allowed: true, every: 5 });
  const [equip, setEquip] = useState<Record<EquipKey, boolean>>({ trainer: true, computer: true, watch: true, hr: false, pm: false });
  const [health, setHealth] = useState<{ kind: "injury" | "illness"; text: string } | null>(null);
  const [time, setTime] = useState("07:00");
  const { busy, run } = useAction();
  const toast = useToast();

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const connect = () => run(async () => {
    const a = await api.post("/api/onboarding/icu", { apiKey, athleteId });
    setProfile((p) => ({ ...p, ftp: a.ftp ?? p.ftp, lthr: a.lthr ?? p.lthr, maxHr: a.maxHr ?? p.maxHr, weightKg: a.weightKg ?? p.weightKg }));
    toast(`Połączono z intervals.icu${a.name ? ` (${a.name})` : ""}.`);
    next();
  });

  const finish = () => run(async () => {
    await api.post("/api/onboarding/complete", {
      profile: { ...profile, lthr: profile.lthr || null, maxHr: profile.maxHr || null, outdoorPowerMeter: equip.pm },
      goals: goalsToApi(goals),
      availability: { days: days.map((d) => ({ ...d, notifyTime: time })), longRideDaysAllowed: longRides.allowed, longRideEveryWeeks: longRides.every },
      equipment: [
        equip.trainer && { kind: "trainer", model: "Trenażer", role: "indoor_recorder" },
        equip.computer && { kind: "bike_computer", model: "Licznik rowerowy", role: "outdoor_master" },
        equip.watch && { kind: "watch", model: "Zegarek", role: equip.computer ? "outdoor_fallback" : "outdoor_master" },
        equip.hr && { kind: "hr_strap", model: "Pas HR" },
        equip.pm && { kind: "power_meter", model: "Miernik mocy" },
      ].filter(Boolean),
      health,
    });
    await api.put("/api/settings/reminder", { time });
    onDone();
  });

  const num = (k: keyof typeof profile, label: string) => (
    <label className="field"><span>{label}</span>
      <input type="number" inputMode="numeric" value={profile[k] || ""} onChange={(e) => setProfile({ ...profile, [k]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div className="app">
      <header className="topbar"><h1>EveryDay</h1><span className="sub">{step + 1}/{STEPS.length} · {STEPS[step]}</span></header>
      <div className="progress-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {step === 0 && <InstallHint />}
      <Card>
        {step === 0 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>Darmowy trener kolarski, który działa w całości na tym telefonie. Dane przychodzą z <strong>intervals.icu</strong> (jazdy, HRV, sen, Body Battery), a treningi trafiają tam z powrotem — do MyWhoosh, licznika i zegarka.</p>
            {demo ? <p className="muted small">Tryb demo: dane są symulowane.</p> : (
              <>
                <label className="field"><span>Klucz API (intervals.icu › Settings › Developer)</span>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                </label>
                <label className="field"><span>ID zawodnika (opcjonalnie, np. i12345)</span>
                  <input value={athleteId} onChange={(e) => setAthleteId(e.target.value)} autoCapitalize="off" />
                </label>
              </>
            )}
            <button className="btn primary block" disabled={busy || (!demo && !apiKey.trim())} onClick={connect}>{busy ? "Sprawdzam…" : "Połącz"}</button>
            {!demo && <button className="btn block" disabled={busy} onClick={() => void setMode("demo")}>Najpierw wypróbuj demo</button>}
            <p className="small muted">Klucz zostaje tylko na tym telefonie i służy wyłącznie do rozmowy z intervals.icu.</p>
          </div>
        )}
        {step === 1 && (
          <>
            {num("weightKg", "Waga (kg)")}{num("heightCm", "Wzrost (cm)")}{num("ftp", "FTP (W)")}
            {num("lthr", "Tętno progowe LTHR (ud/min) — z zegarka lub intervals.icu")}{num("maxHr", "Tętno maksymalne (ud/min)")}
          </>
        )}
        {step === 2 && <GoalEditor g={goals} set={setGoals} />}
        {step === 3 && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>Kiedy możesz jeździć, ile maksymalnie i gdzie zwykle (rano i tak wybierzesz).</p>
            <AvailabilityEditor days={days} set={setDays} />
          </>
        )}
        {step === 4 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>Co kilka tygodni trener zaproponuje Dzień długiej jazdy (4–7 h), zawsze z tygodniowym wyprzedzeniem i do potwierdzenia.</p>
            <label className="check"><input type="checkbox" checked={longRides.allowed} onChange={(e) => setLongRides({ ...longRides, allowed: e.target.checked })} /> Proponuj Dni długiej jazdy</label>
            <label className="field"><span>Co ile tygodni</span>
              <select value={longRides.every} onChange={(e) => setLongRides({ ...longRides, every: Number(e.target.value) })}>
                {[4, 5, 6].map((n) => <option key={n} value={n}>co {n} tygodnie</option>)}
              </select>
            </label>
          </div>
        )}
        {step === 5 && (
          <div className="stack">
            <p className="small muted" style={{ marginTop: 0 }}>Czego używasz? Dotknij, aby zaznaczyć.</p>
            <div className="chips">
              {EQUIPMENT.map((e) => (
                <button key={e.key} className={`btn${equip[e.key] ? " on" : ""}`} aria-pressed={equip[e.key]} onClick={() => setEquip({ ...equip, [e.key]: !equip[e.key] })}>
                  {equip[e.key] ? "✓ " : ""}{e.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 6 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>Coś Cię teraz boli albo dochodzisz do siebie po chorobie?</p>
            <div className="chips">
              <button className={`btn${!health ? " on" : ""}`} aria-pressed={!health} onClick={() => setHealth(null)}>Wszystko OK</button>
              <button className={`btn${health?.kind === "illness" ? " on" : ""}`} aria-pressed={health?.kind === "illness"} onClick={() => setHealth({ kind: "illness", text: "Po chorobie" })}>Po chorobie</button>
              {PAIN_PARTS.map((p) => {
                const on = health?.text === `Ból: ${p}`;
                return <button key={p} className={`btn${on ? " on" : ""}`} aria-pressed={on} onClick={() => setHealth({ kind: "injury", text: `Ból: ${p}` })}>Boli: {p.toLowerCase()}</button>;
              })}
            </div>
            <p className="small muted">Przez tydzień trener odpuści mocne akcenty.</p>
          </div>
        )}
        {step === 7 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>O której przypominać o porannym check-inie?</p>
            <div className="chips">
              {TIMES.map((t) => <button key={t} className={`btn small${t === time ? " on" : ""}`} aria-pressed={t === time} onClick={() => setTime(t)}>{t}</button>)}
            </div>
            <ReminderGuide time={time} />
            <p className="small muted">Możesz to zrobić później — instrukcja jest też w Ustawieniach.</p>
          </div>
        )}
        {step === 8 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>Wszystko gotowe. Trener pobierze historię z intervals.icu, policzy Kondycję i ułoży 4 tygodnie treningów.</p>
            <button className="btn primary block" disabled={busy} onClick={finish}>{busy ? "Układam plan…" : "Zaczynamy"}</button>
          </div>
        )}
      </Card>
      <div className="spread">
        <button className="btn ghost" disabled={step === 0 || busy} onClick={back}>Wstecz</button>
        {step > 0 && step < STEPS.length - 1 && <button className="btn primary" onClick={next}>Dalej</button>}
      </div>
    </div>
  );
}
