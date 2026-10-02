import { useEffect, useState } from "react";
import { api, fmtDate, fmtMinutes } from "../api";
import { StepGraph, StepList } from "../StepGraph";
import { Card, Seg, Sheet, useAction } from "../ui";

const FACES = [
  { value: 1, label: "😫", aria: "1 — bardzo źle" },
  { value: 2, label: "😕", aria: "2 — słabo" },
  { value: 3, label: "😐", aria: "3 — średnio" },
  { value: 4, label: "🙂", aria: "4 — dobrze" },
  { value: 5, label: "😄", aria: "5 — świetnie" },
];
const MODES = [
  { value: "indoor" as const, label: "W domu" },
  { value: "outdoor" as const, label: "Na zewnątrz" },
];
const FEEL = [
  { value: "too_easy" as const, label: "Za łatwo" },
  { value: "just_right" as const, label: "W sam raz" },
  { value: "too_hard" as const, label: "Za ciężko" },
];

export function Today({ goChat }: { goChat: () => void }) {
  const [t, setT] = useState<any>(null);
  const [offline, setOffline] = useState(false);
  const [editCheckIn, setEditCheckIn] = useState(false);
  const { busy, run } = useAction();

  const load = async () => {
    try {
      const d = await api.get("/api/today");
      if (d?.offline) setOffline(true);
      else {
        setT(d);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  if (!t) return <p className="muted center">{offline ? "Brak połączenia z komputerem." : "Ładuję…"}</p>;
  const needsCheckIn = !t.checkIn || editCheckIn;

  return (
    <>
      <header className="topbar">
        <h1>Dziś</h1>
        <span className="sub">{t.weekday}, {fmtDate(t.date).split(" ")[1]}{t.demo ? " · demo" : ""}</span>
      </header>
      {offline && <p className="muted small">Offline — pokazuję ostatnie dane.</p>}

      {t.unrated?.map((r: any) => <RideRating key={r.id} ride={r} onDone={setT} />)}

      {needsCheckIn ? (
        <CheckInCard initial={t.checkIn} defaultMode={t.defaultRideMode} busy={busy}
          onSubmit={(body) => run(async () => { setT(await api.post("/api/checkin", body)); setEditCheckIn(false); })} />
      ) : null}

      {t.readiness && (
        <Card title="Gotowość">
          <div className="readiness">
            <span className={`dot ${t.readiness.state}`} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div><strong>{t.readiness.word}</strong> <span className="muted">· {t.readiness.reason}</span></div>
              {t.readiness.garmin != null && <div className="muted small">Garmin: gotowość {t.readiness.garmin}</div>}
            </div>
            <span className="score" aria-label={`wynik ${t.readiness.score} na 100`}>{t.readiness.score}</span>
          </div>
          {t.checkIn && !editCheckIn && <button className="linkbtn" onClick={() => setEditCheckIn(true)}>Popraw check-in</button>}
        </Card>
      )}

      {t.brief && (
        <Card title="Odprawa" className="brief">
          {t.brief.lines.filter((l: any) => l.key !== "readiness").map((l: any) => (
            <div key={l.key} className={`line ${l.key}`}>
              <span className="label">{l.label}</span>
              {l.text}
              {l.key === "change" && t.change && (
                <div><button className="btn small" disabled={busy} onClick={() => run(async () => setT(await api.post(`/api/adaptations/${t.change.id}/undo`)), "Cofnięto zmianę.")}>Cofnij</button></div>
              )}
            </div>
          ))}
        </Card>
      )}

      {t.workout ? (
        <WorkoutCard w={t.workout} busy={busy} run={run} setT={setT} goChat={goChat} />
      ) : (
        <RestDay t={t} busy={busy} run={run} setT={setT} />
      )}

      {t.ftpSuggestion && <FtpCard s={t.ftpSuggestion} run={run} reload={load} />}
      {t.longRide && <LongRideCard p={t.longRide} run={run} reload={load} />}

      {t.upcoming?.length > 0 && (
        <Card title="Najbliższe dni">
          {t.upcoming.map((u: any) => (
            <div key={u.date} className="spread small" style={{ padding: "4px 0" }}>
              <span>{fmtDate(u.date)}</span>
              <span>{u.isKey ? "★ " : ""}{u.name} <span className="muted">· {fmtMinutes(u.minutes)}</span></span>
            </div>
          ))}
        </Card>
      )}
      {t.sync && t.sync.status !== "ok" && (
        <p className="error">Problem z intervals.icu: {t.sync.status === "auth_error" ? "klucz API odrzucony — sprawdź Ustawienia › Połączenia." : "brak połączenia, dane mogą być nieaktualne."}</p>
      )}
    </>
  );
}

function CheckInCard({ initial, defaultMode, busy, onSubmit }: { initial: any; defaultMode: "indoor" | "outdoor"; busy: boolean; onSubmit: (b: any) => void }) {
  const [sleep, setSleep] = useState<number | null>(initial?.sleepQuality ?? null);
  const [legs, setLegs] = useState<number | null>(initial?.legs ?? null);
  const [mot, setMot] = useState<number | null>(initial?.motivation ?? null);
  const [sick, setSick] = useState<boolean>(initial?.sick ?? false);
  const [pain, setPain] = useState<boolean>(initial?.pain ?? false);
  const [painNote, setPainNote] = useState<string>(initial?.painNote ?? "");
  const [mode, setMode] = useState<"indoor" | "outdoor">(initial?.rideMode ?? defaultMode);
  const ready = sleep && legs && mot;
  return (
    <Card title="Poranny check-in">
      <div className="stack">
        <div><div className="small muted">Jak się spało?</div><Seg label="Sen" value={sleep} options={FACES} onChange={setSleep} /></div>
        <div><div className="small muted">Nogi</div><Seg label="Nogi" value={legs} options={FACES} onChange={setLegs} /></div>
        <div><div className="small muted">Motywacja</div><Seg label="Motywacja" value={mot} options={FACES} onChange={setMot} /></div>
        <div className="row">
          <label className="check"><input type="checkbox" checked={sick} onChange={(e) => setSick(e.target.checked)} /> Choroba</label>
          <label className="check"><input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} /> Coś boli</label>
        </div>
        {pain && (
          <label className="field"><span>Co boli?</span>
            <input value={painNote} onChange={(e) => setPainNote(e.target.value)} placeholder="np. lewe kolano" maxLength={200} />
          </label>
        )}
        <div><div className="small muted">Gdzie dziś jedziesz?</div><Seg text label="Gdzie dziś jedziesz" value={mode} options={MODES} onChange={setMode} /></div>
        <button className="btn primary block" disabled={!ready || busy}
          onClick={() => onSubmit({ sleepQuality: sleep, legs, motivation: mot, sick, pain, painNote: pain ? painNote : undefined, rideMode: mode })}>
          {busy ? "Trener myśli…" : "Gotowe"}
        </button>
      </div>
    </Card>
  );
}

function WorkoutCard({ w, busy, run, setT, goChat }: { w: any; busy: boolean; run: any; setT: (t: any) => void; goChat: () => void }) {
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [minutes, setMinutes] = useState(Math.max(15, Math.round(w.minutes * 0.75 / 5) * 5));
  const [alts, setAlts] = useState<any[] | null>(null);
  const outdoor = w.rideMode === "outdoor";
  const delivery = w.deliveryStatus === "written" ? (outdoor ? "BOLT / Fenix ✔" : "MyWhoosh ✔") : w.deliveryStatus === "failed" ? "nie wysłano ✖" : "wysyłam…";
  const done = w.status === "completed" || w.status === "partial";
  return (
    <Card title="Trening">
      <div className="spread">
        <h3>{w.name}</h3>
        {w.isKey && <span className="tag key">kluczowy</span>}
      </div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>{fmtMinutes(w.minutes)}</span>·<span>obciążenie {w.load}</span>·<span>{outdoor ? "Na zewnątrz" : "W domu"}</span>·<span>{done ? "zrobione ✔" : delivery}</span>
      </div>
      <StepGraph steps={w.steps} />
      {outdoor && w.guidance && <p className="small">{w.guidance}</p>}
      <StepList steps={w.steps} outdoor={outdoor} />
      <p className="small muted">{w.purpose}</p>
      {!done && (
        <div className="row">
          <button className="btn small" disabled={busy} onClick={() => setMinutesOpen(true)}>Mam tylko … min</button>
          <button className="btn small" disabled={busy} onClick={async () => { setSwapOpen(true); setAlts(await api.get(`/api/planned/${w.id}/alternatives`)); }}>Zamień</button>
          <button className="btn small" disabled={busy} onClick={() => run(async () => { await api.post(`/api/planned/${w.id}/skip`); setT(await api.get("/api/today")); }, "Pominięto trening.")}>Pomiń</button>
          <button className="btn small ghost" onClick={goChat}>Czat</button>
          {!outdoor && <a className="btn small ghost" href={`/api/planned/${w.id}/zwo`} download>.zwo</a>}
        </div>
      )}
      <Sheet open={minutesOpen} onClose={() => setMinutesOpen(false)} title="Ile masz czasu?">
        <label className="field"><span>Minuty</span>
          <input type="number" inputMode="numeric" min={15} max={w.minutes} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <button className="btn primary block" disabled={busy} onClick={() => run(async () => { setT(await api.post("/api/today/minutes", { minutes })); setMinutesOpen(false); }, "Skrócono trening.")}>Skróć trening</button>
      </Sheet>
      <Sheet open={swapOpen} onClose={() => setSwapOpen(false)} title="Zamień na podobny">
        {!alts ? <p className="muted">Ładuję…</p> : alts.length === 0 ? <p className="muted">Brak zamienników na ten czas.</p> : (
          <div className="stack">
            {alts.map((a) => (
              <button key={a.slug} className="btn block" disabled={busy} style={{ textAlign: "left" }}
                onClick={() => run(async () => { await api.post(`/api/planned/${w.id}/swap`, { slug: a.slug }); setT(await api.get("/api/today")); setSwapOpen(false); }, "Zamieniono trening.")}>
                {a.name} <span className="muted small">· {fmtMinutes(a.minutes)} · obc. {a.load}</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function RestDay({ t, busy, run, setT }: { t: any; busy: boolean; run: any; setT: (t: any) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [mode, setMode] = useState<"indoor" | "outdoor">(t.defaultRideMode);
  return (
    <Card title={t.skippedToday ? "Trening pominięty" : "Dzień wolny"}>
      <p className="small">{t.skippedToday ? "Odpoczywasz — jutro wracamy do planu." : "Regeneracja to też trening. Masz jednak czas?"}</p>
      {!t.skippedToday && <button className="btn block" onClick={() => setOpen(true)}>Mam dziś czas</button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Dodatkowa jazda">
        <p className="small muted">Spokojny trening, który nie zaszkodzi kolejnemu kluczowemu.</p>
        <label className="field"><span>Ile minut?</span>
          <input type="number" inputMode="numeric" min={20} max={300} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <Seg text label="Gdzie" value={mode} options={MODES} onChange={setMode} />
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy}
          onClick={() => run(async () => { setT(await api.post("/api/bonus", { minutes, rideMode: mode })); setOpen(false); }, "Dodano jazdę.")}>Dodaj</button>
      </Sheet>
    </Card>
  );
}

function RideRating({ ride, onDone }: { ride: any; onDone: (t: any) => void }) {
  const [rpe, setRpe] = useState<number | null>(null);
  const { busy, run } = useAction();
  return (
    <Card title={`Jak było? · ${fmtDate(ride.date)}`}>
      <p className="small" style={{ marginTop: 0 }}>{ride.name} · {fmtMinutes(ride.minutes)}{ride.compliance != null ? ` · wykonanie ${Math.round(ride.compliance)}%` : ""}</p>
      <div className="small muted">Wysiłek (RPE 1–10)</div>
      <div className="seg" role="radiogroup" aria-label="RPE" style={{ flexWrap: "wrap" }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} role="radio" aria-checked={rpe === n} className={rpe === n ? "on" : ""} style={{ flex: "1 0 16%", fontSize: 15 }} onClick={() => setRpe(n)}>{n}</button>
        ))}
      </div>
      <div className="seg text" style={{ marginTop: 8 }}>
        {FEEL.map((f) => (
          <button key={f.value} disabled={!rpe || busy} onClick={() => run(async () => onDone(await api.post(`/api/rides/${ride.id}/rating`, { rpe, feel: f.value })), "Dzięki!")}>{f.label}</button>
        ))}
      </div>
    </Card>
  );
}

function FtpCard({ s, run, reload }: { s: any; run: any; reload: () => void }) {
  const [ftp, setFtp] = useState<number>(s.suggested_ftp || s.current_ftp);
  const manual = !s.suggested_ftp;
  return (
    <Card title="FTP">
      <p className="small" style={{ marginTop: 0 }}>
        {manual ? "Test zrobiony — wpisz FTP z MyWhoosh." : `Twoje FTP wygląda na ${s.suggested_ftp} W (${s.suggested_ftp > s.current_ftp ? "+" : ""}${s.suggested_ftp - s.current_ftp} W).`}
      </p>
      {manual && <label className="field"><span>FTP (W)</span><input type="number" inputMode="numeric" value={ftp} onChange={(e) => setFtp(Number(e.target.value))} /></label>}
      <div className="row">
        <button className="btn primary" onClick={() => run(async () => { await api.post(`/api/ftp-suggestion/${s.id}`, { accept: true, ftp }); reload(); }, "FTP zaktualizowane. Zmień je też w intervals.icu i MyWhoosh.")}>Akceptuj</button>
        <button className="btn" onClick={() => run(async () => { await api.post(`/api/ftp-suggestion/${s.id}`, { accept: false }); reload(); })}>Odrzuć</button>
      </div>
    </Card>
  );
}

function LongRideCard({ p, run, reload }: { p: any; run: any; reload: () => void }) {
  return (
    <Card title="Dzień długiej jazdy">
      <p className="small" style={{ marginTop: 0 }}>Propozycja: {fmtDate(p.proposed_date)} — {fmtMinutes(p.minutes)} spokojnie w Z2. Krok w stronę 200 km.</p>
      <div className="row">
        <button className="btn primary" onClick={() => run(async () => { await api.post(`/api/long-ride/${p.id}`, { confirm: true }); reload(); }, "Zaplanowano długą jazdę.")}>Potwierdzam</button>
        <button className="btn" onClick={() => run(async () => { await api.post(`/api/long-ride/${p.id}`, { confirm: false }); reload(); })}>Nie tym razem</button>
      </div>
    </Card>
  );
}
