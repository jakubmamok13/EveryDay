import { useState } from "react";
import { api } from "../api";
import { AvailabilityEditor, DEFAULT_DAYS, GoalEditor, goalsToApi, type DayForm, type GoalForm } from "../forms";
import { enablePush } from "../push";
import { Card, useAction, useToast } from "../ui";

const STEPS = ["intervals.icu", "Profil", "Cele", "Tydzień", "Długie jazdy", "Sprzęt", "Powiadomienia", "Zdrowie", "Gotowe"];

export function Onboarding({ demo, onDone }: { demo: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [profile, setProfile] = useState({ weightKg: 80, heightCm: 175, ftp: 220, lthr: 0, maxHr: 0, outdoorPowerMeter: false });
  const [goals, setGoals] = useState<GoalForm>({ primary: "raise_ftp", secondary: "endurance", targetKm: 200, targetHours: 7, eventName: "", eventDate: "", priority: "A" });
  const [days, setDays] = useState<DayForm[]>(DEFAULT_DAYS);
  const [longRides, setLongRides] = useState({ allowed: true, every: 5 });
  const [equip, setEquip] = useState({ trainer: "Wahoo KICKR CORE", computer: "Wahoo ELEMNT BOLT v2", watch: "Garmin Fenix 8", hr: "Pas HR", pm: "" });
  const [notifyTime, setNotifyTime] = useState("07:00");
  const [health, setHealth] = useState("");
  const [pushMsg, setPushMsg] = useState("");
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
      profile: { ...profile, lthr: profile.lthr || null, maxHr: profile.maxHr || null },
      goals: goalsToApi(goals),
      availability: { days: days.map((d) => ({ ...d, notifyTime })), longRideDaysAllowed: longRides.allowed, longRideEveryWeeks: longRides.every },
      equipment: [
        equip.trainer && { kind: "trainer", model: equip.trainer, role: "indoor_recorder" },
        equip.computer && { kind: "bike_computer", model: equip.computer, role: "outdoor_master" },
        equip.watch && { kind: "watch", model: equip.watch, role: equip.computer ? "outdoor_fallback" : "outdoor_master" },
        equip.hr && { kind: "hr_strap", model: equip.hr },
        equip.pm && { kind: "power_meter", model: equip.pm },
      ].filter(Boolean),
      health: health.trim() ? { kind: "injury", text: health.trim() } : null,
    });
    onDone();
  });

  const num = (k: keyof typeof profile, label: string) => (
    <label className="field"><span>{label}</span>
      <input type="number" inputMode="numeric" value={(profile[k] as number) || ""} onChange={(e) => setProfile({ ...profile, [k]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div className="app">
      <header className="topbar"><h1>EveryDay</h1><span className="sub">{step + 1}/{STEPS.length} · {STEPS[step]}</span></header>
      <div className="progress-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      <Card>
        {step === 0 && (
          <div className="stack">
            <p style={{ marginTop: 0 }}>Połącz intervals.icu — stamtąd przychodzą jazdy, HRV, sen i Body Battery, a tam trafiają treningi dla MyWhoosh, BOLT i Fenix.</p>
            {demo ? <p className="muted small">Tryb demo: dane są symulowane.</p> : (
              <>
                <label className="field"><span>Klucz API (intervals.icu › Settings › Developer)</span><input value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" /></label>
                <label className="field"><span>ID zawodnika (opcjonalnie, np. i12345)</span><input value={athleteId} onChange={(e) => setAthleteId(e.target.value)} /></label>
              </>
            )}
            <button className="btn primary block" disabled={busy || (!demo && !apiKey.trim())} onClick={connect}>{busy ? "Sprawdzam…" : "Połącz"}</button>
          </div>
        )}
        {step === 1 && (
          <>
            {num("weightKg", "Waga (kg)")}{num("heightCm", "Wzrost (cm)")}{num("ftp", "FTP (W)")}
            {num("lthr", "Tętno progowe LTHR (ud/min) — z Fenixa lub intervals.icu")}{num("maxHr", "Tętno maksymalne (ud/min)")}
            <label className="check"><input type="checkbox" checked={profile.outdoorPowerMeter} onChange={(e) => setProfile({ ...profile, outdoorPowerMeter: e.target.checked })} /> Mam miernik mocy na rowerze szosowym</label>
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
            <p style={{ marginTop: 0 }}>Co kilka tygodni trener zaproponuje Dzień długiej jazdy (5–7 h), zawsze z tygodniowym wyprzedzeniem i do potwierdzenia.</p>
            <label className="check"><input type="checkbox" checked={longRides.allowed} onChange={(e) => setLongRides({ ...longRides, allowed: e.target.checked })} /> Proponuj Dni długiej jazdy</label>
            <label className="field"><span>Co ile tygodni</span>
              <select value={longRides.every} onChange={(e) => setLongRides({ ...longRides, every: Number(e.target.value) })}>
                {[4, 5, 6].map((n) => <option key={n} value={n}>co {n} tygodnie</option>)}
              </select>
            </label>
          </div>
        )}
        {step === 5 && (
          <>
            {(["trainer", "computer", "watch", "hr", "pm"] as const).map((k) => (
              <label key={k} className="field"><span>{{ trainer: "Trenażer", computer: "Licznik rowerowy", watch: "Zegarek", hr: "Pas tętna", pm: "Miernik mocy (jeśli masz)" }[k]}</span>
                <input value={equip[k]} onChange={(e) => setEquip({ ...equip, [k]: e.target.value })} />
              </label>
            ))}
          </>
        )}
        {step === 6 && (
          <div className="stack">
            <label className="field"><span>Godzina porannego powiadomienia (dla każdego dnia możesz ją zmienić w Ustawieniach)</span>
              <input type="time" value={notifyTime} onChange={(e) => setNotifyTime(e.target.value)} />
            </label>
            <button className="btn block" onClick={async () => setPushMsg(await enablePush().catch((e) => e.message))}>Włącz powiadomienia na tym telefonie</button>
            {pushMsg && <p className="small">{pushMsg}</p>}
            <p className="small muted">iPhone: najpierw Udostępnij → „Do ekranu początkowego”, potem otwórz EveryDay z ikony.</p>
          </div>
        )}
        {step === 7 && (
          <label className="field"><span>Coś Cię teraz boli albo dochodzisz do siebie po chorobie? (opcjonalnie)</span>
            <textarea rows={3} value={health} onChange={(e) => setHealth(e.target.value)} placeholder="np. lewe kolano od tygodnia" />
          </label>
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
