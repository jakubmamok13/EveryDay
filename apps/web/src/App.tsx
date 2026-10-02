import { useEffect, useState } from "react";
import { api } from "./api";
import { Chat } from "./screens/Chat";
import { Onboarding } from "./screens/Onboarding";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";
import { Week } from "./screens/Week";
import { Card, ICONS, useAction } from "./ui";

type Tab = "today" | "week" | "chat" | "progress" | "settings";
const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Dziś" },
  { key: "week", label: "Tydzień" },
  { key: "chat", label: "Czat" },
  { key: "progress", label: "Postęp" },
  { key: "settings", label: "Ustawienia" },
];

export function App() {
  const [session, setSession] = useState<any>(null);
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || "today");
  const load = async () => {
    try {
      setSession(await api.get("/api/session"));
    } catch {
      setSession({ offline: true });
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    location.hash = tab === "today" ? "" : tab;
    window.scrollTo(0, 0);
  }, [tab]);

  if (!session) return <p className="muted center" style={{ marginTop: 80 }}>EveryDay…</p>;
  if (session.offline) return <div className="app"><Today goChat={() => undefined} /></div>;
  if (session.needsSetup) return <Auth mode="setup" onDone={load} />;
  if (!session.authenticated) return <Auth mode="login" onDone={load} />;
  if (!session.onboarded) return <Onboarding demo={session.demo} onDone={load} />;

  return (
    <>
      <main className="app">
        {tab === "today" && <Today goChat={() => setTab("chat")} />}
        {tab === "week" && <Week />}
        {tab === "chat" && <Chat />}
        {tab === "progress" && <Progress />}
        {tab === "settings" && <Settings onLogout={load} />}
      </main>
      <nav className="nav" aria-label="Główna nawigacja">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
              {ICONS[t.key]}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function Auth({ mode, onDone }: { mode: "setup" | "login"; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const { busy, run } = useAction();
  return (
    <div className="app">
      <header className="topbar"><h1>EveryDay</h1></header>
      <Card title={mode === "setup" ? "Załóż konto" : "Zaloguj się"}>
        <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await api.post(mode === "setup" ? "/api/setup" : "/api/login", { email, password, remember }); onDone(); }); }}>
          <label className="field"><span>E-mail</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field"><span>Hasło{mode === "setup" ? " (min. 8 znaków)" : ""}</span>
            <input type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "setup" ? 8 : 1} />
          </label>
          {mode === "login" && <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Zapamiętaj to urządzenie</label>}
          <button className="btn primary block" disabled={busy} type="submit">{mode === "setup" ? "Dalej" : "Zaloguj"}</button>
        </form>
      </Card>
    </div>
  );
}
