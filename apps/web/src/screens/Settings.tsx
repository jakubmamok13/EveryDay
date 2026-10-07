import { useEffect, useRef, useState } from "react";
import { api, fmtDate, saveFile } from "../api";
import { AvailabilityEditor, GoalEditor, goalsFromApi, goalsToApi, type DayForm, type GoalForm } from "../forms";
import { DriveBackupCard } from "../Backup";
import { InstallHint, ReminderGuide } from "../reminder";
import { runtime, setMode } from "../runtime";
import { Card, Seg, useAction } from "../ui";

export function Settings() {
  const [s, setS] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const load = async () => {
    setS(await api.get("/api/settings"));
    setStatus(await api.get("/api/status"));
  };
  useEffect(() => {
    void load();
  }, []);
  if (!s) return <p className="muted center">Ładuję…</p>;
  return (
    <>
      <header className="topbar"><h1>Ustawienia</h1>{s.demo && <span className="sub">demo</span>}</header>
      <InstallHint />
      {s.demo && <DemoBanner />}
      <Profile s={s} reload={load} />
      <Goals s={s} reload={load} />
      <Season s={s} reload={load} />
      <Availability s={s} reload={load} />
      <OtherSports s={s} reload={load} />
      <Reminder s={s} reload={load} />
      <Connection s={s} reload={load} />
      <DriveBackupCard demo={s.demo} />
      <Data s={s} />
      <System status={status} reload={load} />
    </>
  );
}

function DemoBanner() {
  return (
    <Card title="Tryb demo">
      <p className="small" style={{ marginTop: 0 }}>Dane są symulowane i trzymane osobno od Twoich.</p>
      <div className="row">
        <button className="btn primary" onClick={() => void setMode("real")}>Wyjdź z demo</button>
        <button className="btn" onClick={() => void setMode("demo", true)}>Zacznij demo od nowa</button>
      </div>
    </Card>
  );
}

function Profile({ s, reload }: { s: any; reload: () => void }) {
  const [p, setP] = useState({ weightKg: s.profile.weightKg ?? "", heightCm: s.profile.heightCm ?? "", ftp: s.profile.ftp, lthr: s.profile.lthr ?? "", maxHr: s.profile.maxHr ?? "", outdoorPowerMeter: s.profile.outdoorPowerMeter, sex: s.profile.sex ?? "m" });
  const { busy, run } = useAction();
  const f = (k: keyof typeof p, label: string) => (
    <label className="field" style={{ flex: "1 1 40%" }}><span>{label}</span>
      <input type="number" inputMode="decimal" value={p[k] as any} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
    </label>
  );
  return (
    <Card title="Profil">
      <div className="row">{f("weightKg", "Waga (kg)")}{f("heightCm", "Wzrost (cm)")}{f("ftp", "FTP (W)")}{f("lthr", "LTHR (ud/min)")}{f("maxHr", "Tętno max")}</div>
      <label className="check"><input type="checkbox" checked={p.outdoorPowerMeter} onChange={(e) => setP({ ...p, outdoorPowerMeter: e.target.checked })} /> Miernik mocy na zewnątrz</label>
      <div className="small muted">Tabela profilu mocy (Coggan)</div>
      <Seg text label="Tabela profilu mocy" value={p.sex} options={[{ value: "m", label: "Mężczyźni" }, { value: "f", label: "Kobiety" }]} onChange={(v) => setP({ ...p, sex: v })} />
      <div style={{ height: 10 }} />
      <button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.put("/api/settings/profile", { ...p, weightKg: Number(p.weightKg), heightCm: Number(p.heightCm) || null, ftp: Number(p.ftp), lthr: Number(p.lthr) || null, maxHr: Number(p.maxHr) || null }); reload(); }, "Zapisano. Pamiętaj o FTP także w intervals.icu i MyWhoosh.")}>Zapisz</button>
    </Card>
  );
}

function Goals({ s, reload }: { s: any; reload: () => void }) {
  const [g, setG] = useState<GoalForm>(goalsFromApi(s.goals));
  const { busy, run } = useAction();
  return (
    <Card title="Cele">
      <GoalEditor g={g} set={setG} />
      <p className="small muted">Zmiana celu układa nowy plan od dziś. Historia i Kondycja zostają.</p>
      <button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.put("/api/settings/goals", { goals: goalsToApi(g) }); reload(); }, "Nowy plan gotowy.")}>Zapisz cele</button>
    </Card>
  );
}

function Availability({ s, reload }: { s: any; reload: () => void }) {
  const [days, setDays] = useState<DayForm[]>(s.availability.days);
  const [lr, setLr] = useState({ allowed: s.availability.longRideDaysAllowed, every: s.availability.longRideEveryWeeks });
  const { busy, run } = useAction();
  return (
    <Card title="Dostępność">
      <AvailabilityEditor days={days} set={setDays} />
      <label className="check"><input type="checkbox" checked={lr.allowed} onChange={(e) => setLr({ ...lr, allowed: e.target.checked })} /> Dni długiej jazdy co
        <select value={lr.every} onChange={(e) => setLr({ ...lr, every: Number(e.target.value) })} style={{ minHeight: 36, borderRadius: 8 }}>{[4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select> tyg.
      </label>
      <button className="btn primary" disabled={busy} onClick={() => run(async () => {
        const r = await api.put("/api/settings/availability", { days, longRideDaysAllowed: lr.allowed, longRideEveryWeeks: lr.every });
        reload();
        return r;
      }, "Zapisano.")}>Zapisz</button>
    </Card>
  );
}

function OtherSports({ s, reload }: { s: any; reload: () => void }) {
  const { busy, run } = useAction();
  return (
    <Card title="Inne sporty">
      <label className="check">
        <input type="checkbox" checked={!!s.otherSports} disabled={busy}
          onChange={(e) => run(async () => { await api.put("/api/settings/other-sports", { enabled: e.target.checked }); reload(); }, "Przeliczono Kondycję i Zmęczenie.")} />
        Licz bieg, siłownię i inne sporty
      </label>
      <p className="small muted">Każdy trening dodaje pełne obciążenie do Zmęczenia. Do Kondycji kolarskiej liczy się jego część: bieg 60%, narty / wiosła 50%, marsz 30%, pływanie 20%, siłownia i joga 0%. Bieg lub siłownia dzień wcześniej mogą też obniżyć gotowość. Szczegóły: Trener › Baza wiedzy › „Inne sporty”.</p>
    </Card>
  );
}

const TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00", "09:00"];

function Reminder({ s, reload }: { s: any; reload: () => void }) {
  const { run } = useAction();
  const time = s.reminder?.time ?? "07:00";
  return (
    <Card title="Poranne przypomnienie">
      <p className="small" style={{ marginTop: 0 }}>EveryDay nie ma serwera, więc przypomnienie ustawiasz raz w telefonie. O której?</p>
      <div className="chips">
        {TIMES.map((t) => (
          <button key={t} className={`btn small${t === time ? " on" : ""}`} aria-pressed={t === time}
            onClick={() => run(async () => { await api.put("/api/settings/reminder", { time: t }); reload(); })}>{t}</button>
        ))}
      </div>
      <ReminderGuide time={time} />
    </Card>
  );
}

function Connection({ s, reload }: { s: any; reload: () => void }) {
  const [key, setKey] = useState("");
  const [id, setId] = useState(s.connection?.athleteId ?? "");
  const { busy, run } = useAction();
  const c = s.connection;
  return (
    <Card title="intervals.icu">
      {s.demo ? <p className="small muted" style={{ marginTop: 0 }}>Demo: dane symulowane.</p> : (
        <p className="small" style={{ marginTop: 0 }}>
          Status: {c ? (c.status === "ok" ? "OK" : c.status === "auth_error" ? "klucz odrzucony" : "brak połączenia") : "nie połączono"}
          {c?.lastSyncAt ? ` · ostatnia synchronizacja ${new Date(c.lastSyncAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}` : ""}
        </p>
      )}
      <button className="btn" disabled={busy} onClick={() => run(async () => { const r = await api.post("/api/sync"); reload(); return r; }, "Zsynchronizowano.")}>Synchronizuj teraz</button>
      <p className="small muted">Aplikacja synchronizuje się sama przy każdym otwarciu. Klucz API zostaje tylko na tym telefonie.</p>
      {!s.demo && (
        <details>
          <summary className="small">Zmień klucz API</summary>
          <label className="field"><span>Klucz API (intervals.icu › Settings › Developer)</span><input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} /></label>
          <label className="field"><span>ID zawodnika (opcjonalnie)</span><input value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="off" /></label>
          <button className="btn" disabled={busy || !key.trim()} onClick={() => run(async () => { await api.put("/api/settings/icu", { apiKey: key, athleteId: id }); setKey(""); reload(); }, "Połączono.")}>Zapisz klucz</button>
        </details>
      )}
    </Card>
  );
}

function Data({ s }: { s: any }) {
  const [confirm, setConfirm] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { busy, run } = useAction();
  const exportAll = () => run(async () => {
    const data = await api.get("/api/export");
    await saveFile(`everyday-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data), "application/json");
  });
  const importFile = (f: File) => run(async () => {
    const data = JSON.parse(await f.text());
    await api.post("/api/import", data);
    await (await runtime()).flush();
    location.reload();
  });
  return (
    <Card title="Dane i kopia zapasowa">
      <p className="small" style={{ marginTop: 0 }}>Kopia do pliku (np. w Plikach / iCloud) — ręcznie, niezależnie od kopii na Dysku Google. Klucz API nie trafia do kopii.</p>
      <div className="row">
        <button className="btn" disabled={busy} onClick={exportAll}>Eksportuj kopię</button>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>Wczytaj kopię</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
      <button className="btn" disabled={busy} onClick={() => run(() => api.post("/api/plan/regenerate"), "Plan ułożony od nowa.")}>Ułóż plan od nowa</button>
      {!s.demo && (
        <div style={{ marginTop: 12 }}>
          {!confirm ? (
            <button className="btn danger" onClick={() => setConfirm(true)}>Usuń wszystkie dane…</button>
          ) : (
            <div className="stack">
              <p className="small">Na pewno? To usuwa plan, historię i klucz API z tego telefonu. Dane w intervals.icu zostają.</p>
              <div className="row">
                <button className="btn danger" disabled={busy} onClick={() => run(async () => { await api.post("/api/wipe", { confirm: "USUŃ" }); await (await runtime()).flush(); location.reload(); })}>Tak, usuń</button>
                <button className="btn" onClick={() => setConfirm(false)}>Nie</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function System({ status, reload }: { status: any; reload: () => void }) {
  const theme = (() => { try { return localStorage.getItem("theme") ?? "auto"; } catch { return "auto"; } })();
  const setTheme = (t: string) => {
    try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage blocked */ }
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    reload();
  };
  const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "—");
  return (
    <Card title="System">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="small">Motyw:</span>
        {[["auto", "jak telefon"], ["light", "jasny"], ["dark", "ciemny"]].map(([k, l]) => (
          <button key={k} className={`btn small${theme === k ? " primary" : ""}`} onClick={() => setTheme(k!)}>{l}</button>
        ))}
      </div>
      {status && (
        <table className="data">
          <tbody>
            <tr><td>Dzienne zadania</td><td>{status.night ? `${status.night.status === "ok" ? "OK" : status.night.status} · ${when(status.night.started_at)}` : "—"}</td></tr>
            <tr><td>Ostatnia synchronizacja</td><td>{when(status.lastCatchUp)}</td></tr>
            <tr><td>Jazdy / dni z danymi</td><td>{status.counts ? `${status.counts.activities} / ${status.counts.wellnessDays}` : "—"}</td></tr>
            <tr><td>Notatki trenera</td><td>{status.notes}</td></tr>
            <tr><td>Strefa czasowa</td><td>{status.timeZone}</td></tr>
          </tbody>
        </table>
      )}
      {!status?.demo && <button className="btn block" style={{ marginTop: 12 }} onClick={() => void setMode("demo")}>Wypróbuj demo (osobne dane)</button>}
    </Card>
  );
}

/** C2 + D2: season events A / B / C (with hot flag). */
function Season({ s, reload }: { s: any; reload: () => void }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<"A" | "B" | "C">("A");
  const [hot, setHot] = useState(false);
  const { busy, run } = useAction();
  return (
    <Card title="Sezon: starty i wyjazdy">
      {s.events.length === 0 ? <p className="small muted" style={{ marginTop: 0 }}>Brak zaplanowanych startów.</p> : s.events.map((e: any) => (
        <div key={e.id} className="note small">
          <span><strong>{e.priority}</strong> · {e.name} · {fmtDate(e.date)}{e.hot ? " · ☀️ upał" : ""}</span>
          <button className="linkbtn" disabled={busy} onClick={() => run(async () => { await api.del(`/api/events/${e.id}`); reload(); }, "Usunięto; plan ułożony na nowo.")}>Usuń</button>
        </div>
      ))}
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "12px 0" }} />
      <label className="field"><span>Data</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field"><span>Nazwa (opcjonalnie)</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
      <Seg text label="Priorytet" value={priority} options={[{ value: "A", label: "A — główny" }, { value: "B", label: "B" }, { value: "C", label: "C — trening" }]} onChange={setPriority} />
      <label className="check"><input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} /> Spodziewany upał (plan aklimatyzacji)</label>
      <p className="tiny muted">A: 2 tygodnie lżej (objętość −25%, potem −50%, intensywność zostaje) i 5 spokojnych dni po. B: 4 lżejsze dni. C: tylko lekki dzień przed.</p>
      <button className="btn primary" disabled={busy || !date} onClick={() => run(async () => { await api.post("/api/events", { date, name, priority, hot }); setDate(""); setName(""); setHot(false); reload(); }, "Dodano; plan ułożony na nowo.")}>Dodaj start</button>
    </Card>
  );
}
