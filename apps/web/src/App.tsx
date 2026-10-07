import { useEffect, useState } from "react";
import { api, CHANGED } from "./api";
import { ensureDriveAccess } from "./drive";
import { Coach } from "./screens/Coach";
import { Onboarding } from "./screens/Onboarding";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";
import { Week } from "./screens/Week";
import { ICONS } from "./ui";

type Tab = "today" | "week" | "coach" | "progress" | "settings";
const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Dziś" },
  { key: "week", label: "Tydzień" },
  { key: "coach", label: "Trener" },
  { key: "progress", label: "Postęp" },
  { key: "settings", label: "Ustawienia" },
];

export function App() {
  const [session, setSession] = useState<{ onboarded: boolean; demo: boolean } | { error: string } | null>(null);
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.key === location.hash.slice(1)) ? (location.hash.slice(1) as Tab) : "today"));
  const load = async () => {
    try {
      setSession(await api.get("/api/session"));
    } catch (e) {
      setSession({ error: (e as Error).message });
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    history.replaceState(null, "", tab === "today" ? location.pathname : `#${tab}`);
    window.scrollTo(0, 0);
  }, [tab]);

  // No server: sync and the daily jobs run when the app opens or comes back (D-043).
  const onboarded = !!session && "onboarded" in session && session.onboarded;
  const demo = !!session && "demo" in session && session.demo;
  useEffect(() => {
    if (!onboarded) return;
    const changed = () => window.dispatchEvent(new Event(CHANGED));
    const go = async (renew: boolean) => {
      // Drive copy (D-068): an expired sign-in is renewed first by a quick silent trip to Google.
      if (renew && !demo && (await ensureDriveAccess()) === "redirecting") return;
      await api.post<{ ran: string }>("/api/catchup").then((r) => r.ran !== "none" && changed(), () => undefined);
      // Then the copy: save new data, or ask when another device saved a newer one.
      await api.post<{ result: string }>("/api/backup/auto").then((b) => b.result === "conflict" && changed(), () => undefined);
    };
    void go(true);
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      // Back after a while counts as opening the app again (iPhone keeps apps in memory for days).
      else void go(Date.now() - hiddenAt > 10 * 60_000);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onboarded, demo]);

  if (!session) return <p className="muted center" style={{ marginTop: 80 }}>EveryDay…</p>;
  if ("error" in session) {
    return (
      <div className="app">
        <p className="error">Nie udało się uruchomić aplikacji: {session.error}</p>
        <button className="btn" onClick={() => location.reload()}>Spróbuj ponownie</button>
      </div>
    );
  }
  if (!session.onboarded) return <Onboarding demo={session.demo} onDone={load} />;

  return (
    <>
      <main className="app">
        {tab === "today" && <Today goCoach={() => setTab("coach")} />}
        {tab === "week" && <Week />}
        {tab === "coach" && <Coach />}
        {tab === "progress" && <Progress />}
        {tab === "settings" && <Settings />}
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
