import { useEffect, useState } from "react";
import { FEELINGS, PAIN_PARTS, type Feeling } from "@everyday/core";
import { api, CHANGED, fmtDate, fmtMinutes, saveFile } from "../api";
import { StepGraph, StepList } from "../StepGraph";
import { WhyCard } from "../WhyCard";
import { BonusOfferCard, CarbsCard, ChallengeChip, ComebackCard, HeatCard, RideRatingCard, SummaryCard, TomorrowCard } from "../Extras";
import { Card, Seg, Sheet, useAction } from "../ui";

const MODES = [
  { value: "indoor" as const, label: "W domu" },
  { value: "outdoor" as const, label: "Na zewnątrz" },
];
const EMOJI: Record<Feeling, string> = { great: "💪", good: "🙂", ok: "😐", worse: "😕", exhausted: "😫", sick: "🤒" };

export function Today({ goCoach }: { goCoach: () => void }) {
  const [t, setT] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState(false);
  const { busy, run } = useAction();

  const load = async () => {
    try {
      setT(await api.get("/api/today"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);

  if (!t) return <p className="muted center">{error ?? "Ładuję…"}</p>;
  const needsCheckIn = (!t.checkIn && !t.brief) || editCheckIn;

  return (
    <>
      <header className="topbar">
        <h1>Dziś</h1>
        <span className="sub">{t.weekday}, {fmtDate(t.date).split(" ")[1]}{t.demo ? " · demo" : ""}</span>
      </header>

      {t.summary && <SummaryCard s={t.summary} setT={setT} />}
      {t.unrated?.map((r: any) => <RideRatingCard key={r.id} ride={r} onDone={setT} />)}
      {t.comeback && <ComebackCard c={t.comeback} />}

      {needsCheckIn && (
        <CheckInCard initial={t.checkIn} defaultMode={t.defaultRideMode} busy={busy} editing={editCheckIn}
          onSubmit={(body) => run(async () => { setT(await api.post("/api/checkin", body)); setEditCheckIn(false); })}
          onSkip={() => run(async () => { setT(await api.post("/api/checkin/skip")); setEditCheckIn(false); })} />
      )}

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
          {!needsCheckIn && (
            <button className="linkbtn" onClick={() => setEditCheckIn(true)}>
              {t.checkIn ? `Samopoczucie: ${FEELINGS[t.checkIn.feeling as Feeling]?.label ?? "zapisane"} · zmień` : "Dodaj samopoczucie"}
            </button>
          )}
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

      {(t.brief || t.readiness) && <WhyCard />}
      {t.tomorrow && <TomorrowCard w={t.tomorrow} setT={setT} />}
      {t.bonusOffer && <BonusOfferCard offer={t.bonusOffer} defaultMode={t.defaultRideMode} setT={setT} />}

      {t.workout ? (
        <WorkoutCard w={t.workout} busy={busy} run={run} setT={setT} goCoach={goCoach} />
      ) : !t.bonusOffer && (
        <RestDay t={t} busy={busy} run={run} setT={setT} />
      )}

      <HeatCard h={t.heat} />
      <CarbsCard c={t.carbs} />
      {t.ftpSuggestion && <FtpCard s={t.ftpSuggestion} run={run} reload={load} />}
      {t.longRide && <LongRideCard p={t.longRide} run={run} reload={load} />}

      {t.upcoming?.length > 0 && (
        <Card title="Najbliższe dni">
          {t.upcoming.map((u: any) => (
            <div key={u.date} className="spread small" style={{ padding: "4px 0" }}>
              <span>{fmtDate(u.date)}</span>
              <span>{u.isKey ? "★ " : ""}{u.name}{/\d+ (h|min)$/.test(u.name) ? null : <span className="muted"> · {fmtMinutes(u.minutes)}</span>}</span>
            </div>
          ))}
        </Card>
      )}
      {t.sync && t.sync.status !== "ok" && (
        <p className="error">Problem z intervals.icu: {t.sync.status === "auth_error" ? "klucz API odrzucony — sprawdź Ustawienia › intervals.icu." : "brak połączenia, dane mogą być nieaktualne."}</p>
      )}
    </>
  );
}

/** One tap: pick where you ride, optionally what hurts, then how you feel (D-044). */
function CheckInCard({ initial, defaultMode, busy, editing, onSubmit, onSkip }: {
  initial: any; defaultMode: "indoor" | "outdoor"; busy: boolean; editing: boolean;
  onSubmit: (b: any) => void; onSkip: () => void;
}) {
  const [mode, setMode] = useState<"indoor" | "outdoor">(initial?.rideMode ?? defaultMode);
  const [painOpen, setPainOpen] = useState(false);
  const [part, setPart] = useState<string | null>(null);
  return (
    <Card title="Jak się dziś czujesz?">
      <div className="stack">
        <Seg text label="Gdzie dziś jedziesz" value={mode} options={MODES} onChange={setMode} />
        <div className="feelings" role="group" aria-label="Samopoczucie">
          {(Object.keys(FEELINGS) as Feeling[]).map((k) => (
            <button key={k} className={`feeling${initial?.feeling === k ? " on" : ""}${k === "exhausted" || k === "sick" ? " stop" : ""}`} disabled={busy}
              onClick={() => onSubmit({ feeling: k, rideMode: mode, painPart: part })}>
              <span className="e" aria-hidden="true">{EMOJI[k]}</span>{FEELINGS[k].label}
            </button>
          ))}
        </div>
        {!painOpen ? (
          <div className="spread">
            <button className="linkbtn" onClick={() => setPainOpen(true)}>Coś boli?</button>
            {!editing && <button className="linkbtn" disabled={busy} onClick={onSkip}>Pomiń</button>}
          </div>
        ) : (
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>Co boli? Potem wybierz samopoczucie.</div>
            <div className="chips">
              {PAIN_PARTS.map((p) => (
                <button key={p} className={`btn small${part === p ? " on" : ""}`} aria-pressed={part === p} onClick={() => setPart(part === p ? null : p)}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const SHORTEN = [30, 45, 60, 75, 90];

function WorkoutCard({ w, busy, run, setT, goCoach }: { w: any; busy: boolean; run: any; setT: (t: any) => void; goCoach: () => void }) {
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [alts, setAlts] = useState<any[] | null>(null);
  const outdoor = w.rideMode === "outdoor";
  const delivery = w.deliveryStatus === "written" ? (outdoor ? "licznik / zegarek ✔" : "MyWhoosh ✔") : w.deliveryStatus === "failed" ? "nie wysłano ✖" : "wysyłam…";
  const done = w.status === "completed" || w.status === "partial";
  const options = SHORTEN.filter((m) => m < w.minutes);
  return (
    <Card title="Trening">
      <div className="spread">
        <h3>{w.name}</h3>
        {w.isKey && <span className="tag key">kluczowy</span>}
      </div>
      <div style={{ margin: "2px 0 6px" }}><ChallengeChip c={w.challenge} /></div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>{fmtMinutes(w.minutes)}</span>·<span>obciążenie {w.load}</span>·<span>{outdoor ? "Na zewnątrz" : "W domu"}</span>·<span>{done ? "zrobione ✔" : delivery}</span>
      </div>
      <StepGraph steps={w.steps} />
      {outdoor && w.guidance && <p className="small">{w.guidance}</p>}
      <StepList steps={w.steps} outdoor={outdoor} />
      <p className="small muted">{w.purpose}</p>
      {!done && (
        <div className="row">
          {options.length > 0 && <button className="btn small" disabled={busy} onClick={() => setMinutesOpen(true)}>Mam mniej czasu</button>}
          <button className="btn small" disabled={busy} onClick={async () => { setSwapOpen(true); setAlts(await api.get(`/api/planned/${w.id}/alternatives`)); }}>Zamień</button>
          <button className="btn small" disabled={busy} onClick={goCoach}>Więcej…</button>
          {!outdoor && (
            <button className="btn small ghost" onClick={() => run(async () => { const f = await api.get(`/api/planned/${w.id}/zwo`); await saveFile(f.filename, f.content, f.type); })}>.zwo</button>
          )}
        </div>
      )}
      <Sheet open={minutesOpen} onClose={() => setMinutesOpen(false)} title="Ile masz czasu?">
        <div className="chips">
          {options.map((m) => (
            <button key={m} className="btn" disabled={busy}
              onClick={() => run(async () => { await api.post("/api/actions/shorten", { minutes: m }); setT(await api.get("/api/today")); setMinutesOpen(false); }, "Skrócono trening.")}>
              {m} min
            </button>
          ))}
        </div>
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

const BONUS = [30, 45, 60, 90, 120];

function RestDay({ t, busy, run, setT }: { t: any; busy: boolean; run: any; setT: (t: any) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"indoor" | "outdoor">(t.defaultRideMode);
  return (
    <Card title={t.skippedToday ? "Dziś odpoczynek" : "Dzień wolny"}>
      <p className="small">{t.skippedToday ? "Odpoczywasz — jutro wracamy do planu." : "Regeneracja to też trening. Masz jednak czas?"}</p>
      {!t.skippedToday && <button className="btn block" onClick={() => setOpen(true)}>Mam dziś czas</button>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Dodatkowa jazda">
        <p className="small muted">Spokojny trening, który nie zaszkodzi kolejnemu kluczowemu.</p>
        <Seg text label="Gdzie" value={mode} options={MODES} onChange={setMode} />
        <div className="chips" style={{ marginTop: 12 }}>
          {BONUS.map((m) => (
            <button key={m} className="btn" disabled={busy}
              onClick={() => run(async () => { setT(await api.post("/api/bonus", { minutes: m, rideMode: mode })); setOpen(false); }, "Dodano jazdę.")}>
              {fmtMinutes(m)}
            </button>
          ))}
        </div>
      </Sheet>
    </Card>
  );
}

function FtpCard({ s, run, reload }: { s: any; run: any; reload: () => void }) {
  const [ftp, setFtp] = useState<number>(s.suggested_ftp || s.current_ftp);
  const manual = !s.suggested_ftp;
  return (
    <Card title="FTP">
      <p className="small" style={{ marginTop: 0 }}>
        {manual ? "Test zrobiony — podaj FTP z MyWhoosh." : s.basis === "detraining"
          ? `Po dłuższej przerwie FTP zwykle spada (Coyle 1984: VO2max −7% w 3 tygodnie). Proponuję ${s.suggested_ftp} W (${s.suggested_ftp - s.current_ftp} W) na start.`
          : `Twoje FTP wygląda na ${s.suggested_ftp} W (${s.suggested_ftp > s.current_ftp ? "+" : ""}${s.suggested_ftp - s.current_ftp} W).`}
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
      <p className="small" style={{ marginTop: 0 }}>Propozycja: {fmtDate(p.proposed_date)} — {fmtMinutes(p.minutes)} spokojnie w Z2. Krok w stronę długich tras.</p>
      <div className="row">
        <button className="btn primary" onClick={() => run(async () => { await api.post(`/api/long-ride/${p.id}`, { confirm: true }); reload(); }, "Zaplanowano długą jazdę.")}>Potwierdzam</button>
        <button className="btn" onClick={() => run(async () => { await api.post(`/api/long-ride/${p.id}`, { confirm: false }); reload(); })}>Nie tym razem</button>
      </div>
    </Card>
  );
}
