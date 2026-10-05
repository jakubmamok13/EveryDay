import { useEffect, useState } from "react";
import { api, CHANGED, fmtDate, fmtMinutes } from "../api";
import { Card, Sheet, useAction, useToast } from "../ui";
import { sportIcon } from "../WhyCard";

const FOCUS: Record<string, string> = {
  sweet_spot: "Sweet Spot", threshold: "Próg", vo2max: "VO2max", base: "Baza", build: "Budowanie", peak: "Szczyt formy", taper: "Taper",
};
const KIND: Record<string, string> = { load: "tydzień budowania", recovery: "tydzień regeneracyjny", taper: "tydzień przed startem" };
const STATUS: Record<string, string> = { completed: "zrobione ✔", partial: "częściowo", skipped: "pominięte", missed: "opuszczone" };

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export function Week() {
  const [start, setStart] = useState<string | null>(null);
  const [w, setW] = useState<any>(null);
  const [sel, setSel] = useState<any>(null);
  const [alts, setAlts] = useState<any[] | null>(null);
  const { busy, run } = useAction();
  const toast = useToast();

  const load = async (s: string | null) => setW(await api.get(`/api/week${s ? `?start=${s}` : ""}`));
  useEffect(() => {
    void load(start);
    const on = () => void load(start);
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, [start]);
  if (!w) return <p className="muted center">Ładuję…</p>;

  const act = async (fn: () => Promise<any>, ok: string) => {
    const r = await run(fn, ok);
    if (r?.warning) toast(r.warning);
    setSel(null);
    setAlts(null);
    await load(w.start);
  };

  const canTap = (x: any, date: string) => date >= w.today && (x.status === "planned" || x.status === "skipped");

  return (
    <>
      <header className="topbar">
        <h1>Tydzień</h1>
        <div className="row">
          <button className="btn small" aria-label="Poprzedni tydzień" onClick={() => setStart(addDays(w.start, -7))}>‹</button>
          <button className="btn small" onClick={() => setStart(null)}>Dziś</button>
          <button className="btn small" aria-label="Następny tydzień" onClick={() => setStart(addDays(w.start, 7))}>›</button>
        </div>
      </header>
      <p className="small muted" style={{ marginTop: -6 }}>
        {fmtDate(w.start)} – {fmtDate(addDays(w.start, 6))}
        {w.focus ? ` · blok: ${FOCUS[w.focus] ?? w.focus}` : ""}{w.kind ? ` · ${KIND[w.kind] ?? w.kind}` : ""}
        {w.targetLoad ? ` · plan ${Math.round(w.targetLoad)} obc.` : ""}
      </p>

      {w.longRide && (
        <Card title="Dzień długiej jazdy">
          <p className="small" style={{ marginTop: 0 }}>{fmtDate(w.longRide.proposed_date)} — {fmtMinutes(w.longRide.minutes)} w Z2.</p>
          <div className="row">
            <button className="btn primary" onClick={() => act(() => api.post(`/api/long-ride/${w.longRide.id}`, { confirm: true }), "Zaplanowano.")}>Potwierdzam</button>
            <button className="btn" onClick={() => act(() => api.post(`/api/long-ride/${w.longRide.id}`, { confirm: false }), "OK.")}>Nie tym razem</button>
          </div>
        </Card>
      )}

      <Card>
        {w.days.map((d: any) => (
          <div key={d.date} className={`week-day${d.date === w.today ? " today" : ""}`}>
            <div className="date small">{fmtDate(d.date)}</div>
            <div>
              {d.workouts.length === 0 && d.rides.length === 0 && <span className="muted small">wolne</span>}
              {d.workouts.map((x: any) => (
                <button key={x.id} className={`w-item ${x.status}`} style={{ display: "block", width: "100%", textAlign: "left", border: 0, cursor: canTap(x, d.date) ? "pointer" : "default" }}
                  onClick={() => canTap(x, d.date) && setSel({ ...x, date: d.date })}>
                  <div className="spread">
                    <strong className="small">{x.isKey ? "★ " : ""}{x.name}</strong>
                    <span className="small muted">{fmtMinutes(x.minutes)}</span>
                  </div>
                  <div className="small muted">
                    {x.rideMode === "outdoor" ? "Na zewnątrz" : "W domu"}{STATUS[x.status] ? ` · ${STATUS[x.status]}` : ""}
                    {x.status === "planned" && x.deliveryStatus === "failed" ? " · nie wysłano do urządzeń" : ""}
                  </div>
                </button>
              ))}
              {d.rides.filter((r: any) => !r.duplicate).map((r: any) => (
                <div key={r.id} className="small" style={{ padding: "2px 10px" }}>
                  {sportIcon(r.sport)} {r.name ?? (r.sportLabel ?? "Jazda")} · {fmtMinutes(r.minutes)}{r.load ? ` · obc. ${Math.round(r.load)}` : ""}{r.sportLabel && r.sportLabel !== String(r.name ?? "").toLowerCase() ? <span className="muted"> · {r.sportLabel}</span> : null}
                </div>
              ))}
              {d.rides.some((r: any) => r.duplicate) && <div className="small muted" style={{ padding: "0 10px" }}>+ duplikat z zegarka (nie liczy się)</div>}
            </div>
          </div>
        ))}
      </Card>

      <Sheet open={!!sel} onClose={() => { setSel(null); setAlts(null); }} title={sel?.name ?? ""}>
        {sel?.status === "skipped" && (
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }}>{fmtDate(sel.date)} · pominięty</p>
            <button className="btn primary block" disabled={busy} onClick={() => act(() => api.post(`/api/planned/${sel.id}/restore`), "Przywrócono trening.")}>Przywróć trening</button>
          </div>
        )}
        {sel?.status === "planned" && (
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }}>{fmtDate(sel.date)} · {fmtMinutes(sel.minutes)} · obciążenie {sel.load}</p>
            <div className="small">Przenieś na:</div>
            <div className="row">
              {[-1, 1, 2].map((n) => {
                const to = addDays(sel.date, n);
                return to >= w.today ? (
                  <button key={n} className="btn small" disabled={busy} onClick={() => act(() => api.post(`/api/planned/${sel.id}/move`, { toDate: to }), `Przeniesiono na ${fmtDate(to)}.`)}>{fmtDate(to)}</button>
                ) : null;
              })}
            </div>
            <button className="btn block" disabled={busy} onClick={async () => setAlts(await api.get(`/api/planned/${sel.id}/alternatives`))}>Zamień na podobny</button>
            {alts?.map((a) => (
              <button key={a.slug} className="btn block small" disabled={busy} style={{ textAlign: "left" }}
                onClick={() => act(() => api.post(`/api/planned/${sel.id}/swap`, { slug: a.slug }), "Zamieniono.")}>
                {a.name} · {fmtMinutes(a.minutes)}
              </button>
            ))}
            <button className="btn block danger" disabled={busy} onClick={() => act(() => api.post(`/api/planned/${sel.id}/skip`), "Pominięto.")}>Pomiń</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
