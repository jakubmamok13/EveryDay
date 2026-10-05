import { useEffect, useState } from "react";
import { api, CHANGED } from "./api";
import { Card } from "./ui";

// "Dlaczego dziś to?" (D-048): plan → signals → rule → decision → load.

const SPORT_ICON: Record<string, string> = {
  run: "🏃", strength: "🏋️", swim: "🏊", walk: "🥾", whole_body: "⛷️", mobility: "🧘", other: "🎾",
};
export const sportIcon = (sport: string | null | undefined) => (sport && sport !== "ride" ? SPORT_ICON[sport] ?? "🏅" : "🚴");

export function WhyCard() {
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState<any>(null);
  const load = () => void api.get("/api/today/why").then(setWhy, () => undefined);
  useEffect(() => {
    if (!open) return;
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, [open]);

  return (
    <Card className="why">
      <button className="why-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>Dlaczego dziś to?</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && !why && <p className="muted small">Ładuję…</p>}
      {open && why && (
        <div className="stack">
          <section>
            <h4>1. Plan</h4>
            {why.plan.lines.map((l: string, i: number) => <p key={i} className="small">{l}</p>)}
          </section>
          <section>
            <h4>2. Sygnały dnia</h4>
            <ul className="signals">
              {why.signals.map((s: any) => (
                <li key={s.key}>
                  <div className="sig-head">
                    <span className="sig-label">{s.label}</span>
                    <span className="sig-value">{s.value}</span>
                    <span className={`rating ${s.rating}`}>{s.ratingWord}</span>
                  </div>
                  <div className="muted tiny">{s.norm}</div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4>3. Reguła</h4>
            <p className="small">{why.rule}</p>
          </section>
          <section>
            <h4>4. Decyzja</h4>
            {why.decision.lines.map((l: string, i: number) => <p key={i} className="small">{l}</p>)}
            {why.decision.whatIf.length > 0 && (
              <details>
                <summary className="small">Co by było, gdyby…</summary>
                <ul className="small">{why.decision.whatIf.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
              </details>
            )}
          </section>
          <section>
            <h4>5. Obciążenie</h4>
            {why.load.lines.map((l: string, i: number) => <p key={i} className="small">{l}</p>)}
            {why.load.otherSports.length > 0 && (
              <p className="small">Inne sporty w ostatnich 7 dniach: {why.load.otherSports.map((o: any) => `${o.label} ×${o.sessions} (obc. ${o.load})`).join(" · ")}.</p>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}
