import { useEffect, useState } from "react";
import { api, CHANGED, fmtDate, fmtMinutes } from "../api";
import { Markdown, noteTitle } from "../markdown";
import { NOTES } from "../runtime";
import { Card, Seg, Sheet, useAction, useToast } from "../ui";

// Buttons instead of chat (D-044). Every change passes the Safe Envelope and
// can be undone from Dziś.

const SHORTEN = [30, 45, 60, 75, 90];
const TRAVEL = [3, 7, 14];

export function Coach() {
  const [a, setA] = useState<any>(null);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [travel, setTravel] = useState<{ from: "today" | "tomorrow"; days: number | null }>({ from: "tomorrow", days: null });
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);
  const { busy, run } = useAction();
  const toast = useToast();

  const load = async () => setA(await api.get("/api/actions"));
  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);

  const act = (path: string, body: unknown = {}) =>
    run(async () => {
      const r = await api.post<{ ok: boolean; messages: string[] }>(path, body);
      toast(r.messages.join(" "));
      await load();
      return r;
    });

  if (!a) return <p className="muted center">Ładuję…</p>;
  const w = a.today;
  const options = w ? SHORTEN.filter((m) => m < w.minutes) : [];
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromDate = travel.from === "today" ? iso(today) : iso(new Date(today.getTime() + 86_400_000));

  return (
    <>
      <header className="topbar"><h1>Trener</h1><span className="sub">bez pisania — wystarczy dotknąć</span></header>

      <Card title="Dzisiejszy trening">
        {w ? (
          <>
            <p className="small" style={{ marginTop: 0 }}><strong>{w.name}</strong> · {fmtMinutes(w.minutes)}</p>
            <div className="chips">
              {options.length > 0 && <button className="btn" disabled={busy} onClick={() => setMinutesOpen(true)}>Mam mniej czasu</button>}
              <button className="btn" disabled={busy} onClick={() => act("/api/actions/easier")}>Lżej dziś</button>
              <button className="btn" disabled={busy} onClick={() => act("/api/actions/rest")}>Dziś odpoczynek</button>
              <button className="btn" disabled={busy} onClick={() => act("/api/actions/tomorrow")}>Przesuń na jutro</button>
            </div>
          </>
        ) : <p className="small muted" style={{ margin: 0 }}>Dziś nie ma treningu do zmiany.</p>}
      </Card>

      <Card title="Coś boli?">
        <p className="small muted" style={{ marginTop: 0 }}>Zapamiętam na 7 dni: bez mocnych akcentów, dziś lżej.</p>
        <div className="chips">
          {a.painParts.map((p: string) => (
            <button key={p} className="btn" disabled={busy} onClick={() => act("/api/actions/pain", { part: p })}>{p}</button>
          ))}
        </div>
      </Card>

      <Card title="Wyjazd">
        <Seg text label="Od kiedy" value={travel.from} options={[{ value: "today", label: "Od dziś" }, { value: "tomorrow", label: "Od jutra" }]}
          onChange={(from) => setTravel({ ...travel, from })} />
        <div className="chips" style={{ marginTop: 10 }}>
          {TRAVEL.map((d) => (
            <button key={d} className="btn" disabled={busy} onClick={() => setTravel({ ...travel, days: d })}>{d} dni</button>
          ))}
        </div>
      </Card>

      <Card title="Dlaczego ten trening?">
        {a.why.workout ? (
          <>
            <p className="small" style={{ marginTop: 0 }}><strong>{a.why.workout.name}:</strong> {a.why.workout.purpose}</p>
            {a.why.workout.cue && <p className="small">Wskazówka: {a.why.workout.cue}</p>}
          </>
        ) : <p className="small" style={{ marginTop: 0 }}>Dziś bez treningu — regeneracja też buduje formę.</p>}
        {a.why.sections.map((s: any) => (
          <details key={s.heading} style={{ marginTop: 8 }}>
            <summary className="small">{s.heading}</summary>
            <Markdown text={s.text} />
          </details>
        ))}
      </Card>

      {a.notes.length > 0 && (
        <Card title="Pamiętam">
          {a.notes.map((n: any) => (
            <div key={n.id} className="note small">
              <span>{n.text} <span className="muted">· {n.start_date > fmtIso() ? `od ${fmtDate(n.start_date)} ` : ""}do {fmtDate(n.end_date)}</span></span>
              <button className="linkbtn" disabled={busy} aria-label={`Zapomnij: ${n.text}`}
                onClick={() => run(async () => { await api.del(`/api/notes/${n.id}`); await load(); }, "Zapomniane.")}>Zapomnij</button>
            </div>
          ))}
        </Card>
      )}

      <HitBlockCard />

      <Card title="Baza wiedzy">
        {NOTES.map((n) => (
          <button key={n.path} className="linkbtn" style={{ display: "block", textAlign: "left" }} onClick={() => setNote({ title: noteTitle(n.text, n.path), text: n.text })}>
            {noteTitle(n.text, n.path)}
          </button>
        ))}
      </Card>

      <Sheet open={minutesOpen} onClose={() => setMinutesOpen(false)} title="Ile masz czasu?">
        <div className="chips">
          {options.map((m) => (
            <button key={m} className="btn" disabled={busy} onClick={async () => { await act("/api/actions/shorten", { minutes: m }); setMinutesOpen(false); }}>{m} min</button>
          ))}
        </div>
      </Sheet>
      <Sheet open={travel.days !== null} onClose={() => setTravel({ ...travel, days: null })} title="Wyjazd">
        <p className="small" style={{ marginTop: 0 }}>Od {fmtDate(fromDate)} przez {travel.days} dni bez treningów. Zaplanowane jazdy w tych dniach zostaną pominięte — każdą przywrócisz jednym dotknięciem w Tygodniu.</p>
        <button className="btn primary block" disabled={busy}
          onClick={async () => { await act("/api/actions/travel", { fromDate, days: travel.days }); setTravel({ ...travel, days: null }); }}>Potwierdź</button>
      </Sheet>
      <Sheet open={!!note} onClose={() => setNote(null)} title={note?.title ?? ""}>
        {note && <Markdown text={note.text.replace(/^#\s+.+$/m, "")} />}
      </Sheet>
    </>
  );
}

function fmtIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** C5: one-week VO2max block (Rønnestad), then 3 weeks with 1 HIT session. */
function HitBlockCard() {
  const [h, setH] = useState<any>(null);
  const { busy, run } = useAction();
  const load = () => void api.get("/api/plan/hit-block").then(setH);
  useEffect(load, []);
  if (!h) return null;
  return (
    <Card title="⚡ Blok interwałowy">
      <p className="small" style={{ marginTop: 0 }}>Tydzień z sesją VO2max w każdy dzień treningowy, potem 3 tygodnie z jedną taką sesją i spokojną jazdą. U wytrenowanych kolarzy dał +4,6% VO2max wobec braku zmian przy zwykłym rozkładzie (Rønnestad). Gotowość nadal pilnuje każdego dnia.</p>
      {h.active ? (
        <>
          <p className="small"><strong>Aktywny od {fmtDate(h.active.start)}:</strong> {h.active.phase}.</p>
          <button className="btn small" disabled={busy} onClick={() => run(async () => { await api.post("/api/plan/hit-block", { on: false }); load(); }, "Anulowano blok.")}>Anuluj blok</button>
        </>
      ) : h.available ? (
        <button className="btn primary small" disabled={busy} onClick={() => run(async () => { await api.post("/api/plan/hit-block", { on: true }); load(); }, "Zaplanowano blok interwałowy.")}>Zaplanuj od {fmtDate(h.candidate)}</button>
      ) : <p className="small muted" style={{ marginBottom: 0 }}>{h.why ?? "Niedostępny teraz."}</p>}
    </Card>
  );
}
