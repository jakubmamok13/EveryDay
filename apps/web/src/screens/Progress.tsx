import { useEffect, useState } from "react";
import { api, fmtDate, fmtMinutes } from "../api";
import { ColumnChart, Legend, LineChart, TableToggle } from "../charts";
import { Card } from "../ui";

export function Progress() {
  const [p, setP] = useState<any>(null);
  useEffect(() => {
    void api.get("/api/progress").then(setP);
  }, []);
  if (!p) return <p className="muted center">Ładuję…</p>;

  const rows = [...p.series, ...p.projection];
  const dates = rows.map((r: any) => r.date);
  const split = p.series.length;
  const lr = p.longRide;
  const target = lr.targetMinutes ?? 420;
  const weeks = p.weeks;
  const pct = weeks.map((w: any) => (w.planned ? Math.round((w.done / w.planned) * 100) : null));

  return (
    <>
      <header className="topbar"><h1>Postęp</h1></header>

      <Card title="FTP">
        <div className="stats">
          <div className="stat"><div className="v">{p.current.ftp} W</div><div className="l">FTP</div></div>
          <div className="stat"><div className="v">{p.current.wkg ?? "—"}</div><div className="l">W/kg</div></div>
        </div>
        <TableToggle>
          <table className="data">
            <thead><tr><th>Od</th><th>FTP</th><th>W/kg</th><th>Źródło</th></tr></thead>
            <tbody>{p.ftp.map((f: any, i: number) => <tr key={i}><td>{f.date ? fmtDate(f.date) : "start"}</td><td>{Math.round(f.ftp)}</td><td>{f.wkg ?? "—"}</td><td>{f.source}</td></tr>)}</tbody>
          </table>
          <table className="data" style={{ marginTop: 8 }}>
            <thead><tr><th>Strefa</th><th>od W</th><th>do W</th></tr></thead>
            <tbody>{p.current.zones.map((z: any) => <tr key={z.zone}><td>Z{z.zone} {z.name}</td><td>{z.low}</td><td>{z.high ?? "∞"}</td></tr>)}</tbody>
          </table>
        </TableToggle>
      </Card>

      <Card title="Kondycja i zmęczenie (90 dni + plan)">
        <Legend items={[{ label: "Kondycja", color: "--s-fitness" }, { label: "Zmęczenie", color: "--s-fatigue" }]} projection />
        <LineChart dates={dates} splitAt={split} ariaLabel="Kondycja i zmęczenie przez ostatnie 90 dni i prognoza na 4 tygodnie"
          series={[
            { key: "fit", label: "Kondycja", color: "--s-fitness", values: rows.map((r: any) => r.fitness) },
            { key: "fat", label: "Zmęczenie", color: "--s-fatigue", values: rows.map((r: any) => r.fatigue) },
          ]} />
        <TableToggle>
          <table className="data">
            <thead><tr><th>Dzień</th><th>Kondycja</th><th>Zmęczenie</th><th>Forma</th></tr></thead>
            <tbody>{rows.slice(-35).map((r: any, i: number) => <tr key={i}><td>{fmtDate(r.date)}</td><td>{Math.round(r.fitness)}</td><td>{Math.round(r.fatigue)}</td><td>{Math.round(r.form)}</td></tr>)}</tbody>
          </table>
        </TableToggle>
      </Card>

      <Card title="Forma (Kondycja − Zmęczenie)">
        <LineChart dates={dates} splitAt={split} zeroLine height={130} ariaLabel="Forma przez ostatnie 90 dni i prognoza"
          series={[{ key: "form", label: "Forma", color: "--s-form", values: rows.map((r: any) => r.form) }]} />
        <p className="small muted">Ujemna po ciężkim tygodniu to normalne. Poniżej −30% Kondycji trener zwalnia.</p>
      </Card>

      <Card title={lr.targetKm ? `Droga do ${lr.targetKm} km` : "Długie jazdy"}>
        <div className="small">Najdłuższa jazda: <strong>{fmtMinutes(lr.longestMinutes)}</strong>{lr.longestKm ? ` · ${lr.longestKm} km` : ""}</div>
        <div className="small muted">Cel: {fmtMinutes(target)}{lr.targetKm ? ` · ${lr.targetKm} km` : ""}</div>
        <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={lr.longestMinutes} aria-label="Postęp długiej jazdy">
          <div className="fill" style={{ width: `${Math.min(100, (lr.longestMinutes / target) * 100)}%` }} />
          {lr.milestones.filter((m: number) => m <= target).map((m: number) => (
            <div key={m} className="tick" style={{ left: `${(m / target) * 100}%` }}><span>{m / 60} h</span></div>
          ))}
        </div>
      </Card>

      <Card title="Wykonanie planu (12 tygodni)">
        {pct.every((v: number | null) => v === null) ? <p className="small muted">Wykonanie pojawi się po pierwszym tygodniu planu.</p> : <ColumnChart labels={weeks.map((w: any) => fmtDate(w.start).split(" ")[1])} values={pct} max={100} unit="%"
          ariaLabel="Procent wykonanych treningów w każdym z ostatnich 12 tygodni"
          describe={(i) => `${fmtDate(weeks[i].start)}: ${weeks[i].done}/${weeks[i].planned} treningów · obciążenie ${weeks[i].load}/${weeks[i].plannedLoad}`} />}
        <TableToggle>
          <table className="data">
            <thead><tr><th>Tydzień</th><th>Zrobione</th><th>Obciążenie</th></tr></thead>
            <tbody>{weeks.map((w: any) => <tr key={w.start}><td>{fmtDate(w.start)}</td><td>{w.done}/{w.planned}</td><td>{w.load}/{w.plannedLoad}</td></tr>)}</tbody>
          </table>
        </TableToggle>
      </Card>
    </>
  );
}
