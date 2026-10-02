import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import { AvailabilityEditor, GoalEditor, goalsFromApi, goalsToApi, type DayForm, type GoalForm } from "../forms";
import { enablePush, isIos, isStandalone } from "../push";
import { Card, useAction } from "../ui";

export function Settings({ onLogout }: { onLogout: () => void }) {
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
      <Profile s={s} reload={load} />
      <Goals s={s} reload={load} />
      <Availability s={s} reload={load} />
      <Notifications s={s} reload={load} />
      <Coach s={s} reload={load} status={status} />
      <Connection s={s} reload={load} />
      <Data s={s} reload={load} />
      <System status={status} s={s} reload={load} onLogout={onLogout} />
    </>
  );
}

function Profile({ s, reload }: { s: any; reload: () => void }) {
  const [p, setP] = useState({ weightKg: s.profile.weightKg ?? "", heightCm: s.profile.heightCm ?? "", ftp: s.profile.ftp, lthr: s.profile.lthr ?? "", maxHr: s.profile.maxHr ?? "", outdoorPowerMeter: s.profile.outdoorPowerMeter });
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
      <p className="small muted">Sprzęt: {s.equipment.map((e: any) => e.model).join(" · ")}</p>
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
    <Card title="Dostępność i godziny powiadomień">
      <AvailabilityEditor days={days} set={setDays} showTimes />
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

function Notifications({ s, reload }: { s: any; reload: () => void }) {
  const [msg, setMsg] = useState("");
  const { busy, run } = useAction();
  return (
    <Card title="Powiadomienia">
      {isIos() && !isStandalone() && <p className="small">Na iPhonie: Udostępnij → „Do ekranu początkowego”, potem otwórz EveryDay z ikony i włącz powiadomienia.</p>}
      <div className="row">
        <button className="btn" onClick={async () => { setMsg(await enablePush().catch((e) => e.message)); reload(); }}>Włącz na tym urządzeniu</button>
        <button className="btn" disabled={busy} onClick={() => run(async () => { const r = await api.post("/api/push/test"); setMsg(`Wysłano do ${r.sent} urządzeń.`); })}>Wyślij test</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      {s.pushDevices.map((d: any) => (
        <div key={d.id} className="spread small" style={{ padding: "4px 0" }}>
          <span>{d.platform} · od {d.created_at.slice(0, 10)}</span>
          <button className="linkbtn" onClick={() => run(async () => { await api.del(`/api/push/${d.id}`); reload(); })}>Usuń</button>
        </div>
      ))}
    </Card>
  );
}

function Coach({ s, reload, status }: { s: any; reload: () => void; status: any }) {
  const [c, setC] = useState(s.coach);
  const { busy, run } = useAction();
  const txt = (k: string, label: string) => <label className="field"><span>{label}</span><input value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></label>;
  return (
    <Card title="Trener (AI na tym komputerze)">
      <p className="small" style={{ marginTop: 0 }}>Ton: kumpel · format odprawy: stały · zasady bezpieczeństwa: stałe.</p>
      <p className="small">Status AI: {status?.ai?.reachable ? `działa (${status.ai.model})` : c.aiEnabled ? "niedostępne — działa tryb szablonów" : "wyłączone"}</p>
      <label className="check"><input type="checkbox" checked={c.aiEnabled} onChange={(e) => setC({ ...c, aiEnabled: e.target.checked })} /> Używaj AI (Ollama)</label>
      {txt("model", "Model")}{txt("fallbackModel", "Model zapasowy")}{txt("embedModel", "Model do wyszukiwania wiedzy")}{txt("ollamaUrl", "Adres Ollama")}
      <button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.put("/api/settings/coach", c); reload(); }, "Zapisano.")}>Zapisz</button>
    </Card>
  );
}

function Connection({ s, reload }: { s: any; reload: () => void }) {
  const [key, setKey] = useState("");
  const [id, setId] = useState(s.connection?.athleteId ?? "");
  const { busy, run } = useAction();
  const c = s.connection;
  return (
    <Card title="Połączenia — intervals.icu">
      {s.demo ? <p className="small muted">Demo: dane symulowane.</p> : (
        <p className="small" style={{ marginTop: 0 }}>
          Status: {c ? (c.status === "ok" ? "OK" : c.status === "auth_error" ? "klucz odrzucony" : "brak połączenia") : "nie połączono"}
          {c?.lastSyncAt ? ` · ostatnia synchronizacja ${c.lastSyncAt.slice(0, 16).replace("T", " ")}` : ""}
        </p>
      )}
      <button className="btn" disabled={busy} onClick={() => run(async () => { const r = await api.post("/api/sync"); reload(); return r; }, "Zsynchronizowano.")}>Synchronizuj teraz</button>
      {!s.demo && (
        <details style={{ marginTop: 10 }}>
          <summary className="small">Zmień klucz API</summary>
          <label className="field"><span>Klucz API</span><input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <label className="field"><span>ID zawodnika</span><input value={id} onChange={(e) => setId(e.target.value)} /></label>
          <button className="btn" disabled={busy || !key} onClick={() => run(async () => { await api.post("/api/onboarding/icu", { apiKey: key, athleteId: id }); setKey(""); reload(); }, "Połączono.")}>Zapisz klucz</button>
        </details>
      )}
    </Card>
  );
}

function Data({ s, reload }: { s: any; reload: () => void }) {
  const [dir, setDir] = useState(s.backup?.dir ?? "");
  const [confirm, setConfirm] = useState("");
  const { busy, run } = useAction();
  return (
    <Card title="Dane i prywatność">
      <a className="btn block" href="/api/export" download>Eksportuj wszystkie dane (ZIP)</a>
      <label className="field" style={{ marginTop: 12 }}><span>Dodatkowy folder kopii zapasowych (np. D:\Kopie)</span><input value={dir} onChange={(e) => setDir(e.target.value)} /></label>
      <button className="btn" disabled={busy} onClick={() => run(async () => { await api.put("/api/settings/backup", { dir }); reload(); }, "Zapisano.")}>Zapisz folder</button>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
      <button className="btn" disabled={busy} onClick={() => run(() => api.post("/api/plan/regenerate"), "Plan ułożony od nowa.")}>Ułóż plan od nowa</button>
      <details style={{ marginTop: 12 }}>
        <summary className="small">Usuń konto</summary>
        <p className="small">To usuwa wszystkie dane z tego komputera. Wpisz USUŃ:</p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ minHeight: 40, borderRadius: 10, border: "1px solid var(--axis)", padding: "0 10px" }} />
        <button className="btn danger" disabled={confirm !== "USUŃ" || busy} onClick={() => run(async () => { await api.post("/api/account/delete", { confirm }); location.reload(); })}>Usuń na zawsze</button>
      </details>
    </Card>
  );
}

function System({ status, s, reload, onLogout }: { status: any; s: any; reload: () => void; onLogout: () => void }) {
  const { run } = useAction();
  const theme = typeof localStorage !== "undefined" ? (() => { try { return localStorage.getItem("theme") ?? "auto"; } catch { return "auto"; } })() : "auto";
  const setTheme = (t: string) => {
    try { if (t === "auto") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch { /* storage blocked */ }
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    reload();
  };
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
            <tr><td>Nocne zadanie</td><td>{status.night ? `${status.night.status} · ${status.night.started_at.slice(0, 16).replace("T", " ")}` : "—"}</td></tr>
            <tr><td>Synchronizacja</td><td>{status.sync ? `${status.sync.status} · ${status.sync.started_at.slice(0, 16).replace("T", " ")}` : "—"}</td></tr>
            <tr><td>AI</td><td>{status.ai.reachable ? "działa" : "niedostępne"}</td></tr>
            <tr><td>Urządzenia z powiadomieniami</td><td>{status.pushDevices}</td></tr>
            <tr><td>Baza wiedzy</td><td>{status.knowledgeChunks} fragmentów</td></tr>
            <tr><td>Wolne miejsce</td><td>{status.freeGb ?? "—"} GB</td></tr>
          </tbody>
        </table>
      )}
      <h2 style={{ marginTop: 16 }}>Zalogowane urządzenia</h2>
      {s.sessions.map((x: any) => (
        <div key={x.id} className="spread small" style={{ padding: "4px 0" }}>
          <span>{(x.device_name ?? "urządzenie").slice(0, 40)} · {x.last_seen_at ? fmtDate(x.last_seen_at.slice(0, 10)) : "—"}</span>
          <button className="linkbtn" onClick={() => run(async () => { await api.del(`/api/sessions/${x.id}`); reload(); })}>Wyloguj</button>
        </div>
      ))}
      <button className="btn block" style={{ marginTop: 12 }} onClick={() => run(async () => { await api.post("/api/logout"); onLogout(); })}>Wyloguj się</button>
    </Card>
  );
}
