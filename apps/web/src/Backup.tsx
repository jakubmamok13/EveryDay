import { useEffect, useState } from "react";
import SCRIPT from "../../../tools/everyday-kopia.gs?raw";
import { api } from "./api";
import { runtime } from "./runtime";
import { Card, useAction, useToast } from "./ui";

// Copy on the athlete's Google Drive through an Apps Script link (D-067).

const SCRIPT_ON_GITHUB = "https://github.com/jakubmamok13/EveryDay/blob/master/tools/everyday-kopia.gs";
const stamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : null;

/** After a restore the whole app starts again from the restored data. */
async function reloadAfterRestore() {
  await (await runtime()).flush();
  location.reload();
}

function SetupSteps() {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT);
      toast("Skopiowano kod skryptu.");
    } catch {
      toast("Nie udało się skopiować — zaznacz kod poniżej.");
    }
  };
  return (
    <details>
      <summary className="small">Jak to ustawić (raz, ok. 10 minut, najwygodniej na komputerze)</summary>
      <ol className="steps-guide">
        <li>Otwórz <strong>script.google.com</strong> na koncie Google, na którego Dysku ma być kopia › <strong>Nowy projekt</strong>.</li>
        <li>Usuń przykładowy kod i wklej kod skryptu (przycisk niżej albo <a href={SCRIPT_ON_GITHUB} target="_blank" rel="noreferrer">plik w repozytorium</a>). Zapisz.</li>
        <li><strong>Wdróż › Nowe wdrożenie</strong> › typ <strong>Aplikacja internetowa</strong>; „Wykonaj jako”: <strong>Ja</strong>; „Kto ma dostęp”: <strong>Każdy</strong> › Wdróż. (Po angielsku: Deploy › New deployment › Web app › Execute as: Me › Who has access: Anyone.)</li>
        <li>Zezwól na dostęp: wybierz konto › „Google nie zweryfikował tej aplikacji” › Zaawansowane › Przejdź do projektu (to Twój własny skrypt) › Zezwól.</li>
        <li>Skopiuj <strong>adres URL aplikacji internetowej</strong> (kończy się na <code>/exec</code>), wyślij go sobie na telefon i wklej poniżej.</li>
      </ol>
      <div className="row">
        <button className="btn small" onClick={() => void copy()}>Kopiuj kod skryptu</button>
      </div>
      <details>
        <summary className="tiny muted">Pokaż kod</summary>
        <textarea className="code" readOnly value={SCRIPT} rows={8} aria-label="Kod skryptu kopii" />
      </details>
    </details>
  );
}

/** Settings › Kopia na Dysku Google. */
export function DriveBackupCard({ demo }: { demo: boolean }) {
  const [st, setSt] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [exists, setExists] = useState<{ savedAt: string | null } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const { busy, run } = useAction();
  const toast = useToast();
  const load = async () => setSt(await api.get("/api/backup"));
  useEffect(() => {
    if (!demo) void load();
  }, [demo]);

  if (demo) {
    return (
      <Card title="Kopia na Dysku Google">
        <p className="small muted" style={{ margin: 0 }}>W trybie demo kopia jest wyłączona.</p>
      </Card>
    );
  }
  if (!st) return null;

  const connect = () => run(async () => {
    const r = await api.post("/api/backup/connect", { url });
    setUrl("");
    setSt(r.status);
    if (r.state === "exists") setExists(r.remote);
    else toast("Połączono. Kopia zapisana na Dysku Google.");
  });
  const restore = () => run(async () => {
    await api.post("/api/backup/restore");
    await reloadAfterRestore();
  });
  const replace = () => run(async () => {
    const r = await api.post("/api/backup/save");
    setExists(null);
    setSt(r.status);
  }, "Zapisano kopię z tego telefonu na Dysku.");

  return (
    <Card title="Kopia na Dysku Google">
      {exists ? (
        <div className="stack">
          <p className="small" style={{ marginTop: 0 }}>Na Dysku jest już kopia z <strong>{stamp(exists.savedAt) ?? "nieznanego dnia"}</strong>. Co zrobić?</p>
          <button className="btn primary block" disabled={busy} onClick={() => void restore()}>Wczytaj kopię z Dysku (zastąpi dane w telefonie)</button>
          <button className="btn block" disabled={busy} onClick={replace}>Zastąp ją danymi z tego telefonu</button>
        </div>
      ) : st.connected ? (
        <div className="stack">
          <p className="small" style={{ marginTop: 0 }}>
            Połączono. Ostatnia kopia: <strong>{stamp(st.lastSavedAt) ?? "jeszcze żadnej"}</strong>. Aplikacja zapisuje kopię sama po każdej zmianie (gdy jest internet).
          </p>
          {st.conflict && <p className="small warn">Na Dysku jest nowsza kopia z innego urządzenia ({stamp(st.conflict.savedAt)}) — wybierz na ekranie Dziś, które dane zostają.</p>}
          {st.error && <p className="small warn">Ostatnia próba ({stamp(st.error.at)}) nieudana: {st.error.message}</p>}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => run(async () => setSt((await api.post("/api/backup/save")).status), "Zapisano kopię na Dysku.")}>Zapisz kopię teraz</button>
            {!confirmRestore && <button className="btn" disabled={busy} onClick={() => setConfirmRestore(true)}>Wczytaj z Dysku…</button>}
          </div>
          {confirmRestore && (
            <div className="stack">
              <p className="small">Dane w tym telefonie zostaną zastąpione kopią z Dysku. Klucz API zostaje.</p>
              <div className="row">
                <button className="btn primary" disabled={busy} onClick={() => void restore()}>Tak, wczytaj</button>
                <button className="btn" onClick={() => setConfirmRestore(false)}>Nie</button>
              </div>
            </div>
          )}
          <button className="linkbtn" disabled={busy} onClick={() => run(async () => setSt(await api.del("/api/backup")), "Odłączono. Kopia na Dysku zostaje.")}>Odłącz</button>
        </div>
      ) : (
        <div className="stack">
          <p className="small" style={{ marginTop: 0 }}>
            Dane są w tym telefonie; usunięcie ikony aplikacji albo nowy telefon je kasuje. Z kopią na Twoim Dysku Google aplikacja zapisuje wszystko sama
            i wczytuje to na innym telefonie. Na Dysku powstaje folder „EveryDay” (kopia bieżąca + kopie z 14 dni).
          </p>
          <p className="tiny muted" style={{ margin: 0 }}>Kto zna adres skryptu, może kopię odczytać i nadpisać. Klucz API intervals.icu nie trafia do kopii.</p>
          <SetupSteps />
          <label className="field" style={{ marginBottom: 0 }}><span>Adres skryptu (…/exec)</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" />
          </label>
          <button className="btn primary" disabled={busy || !url.trim()} onClick={() => void connect()}>Połącz</button>
        </div>
      )}
    </Card>
  );
}

/** Today: a newer copy from another device, or the copy has not worked for a week. */
export function BackupNoticeCard({ b, reload }: { b: any; reload: () => void }) {
  const { busy, run } = useAction();
  if (!b) return null;
  if (b.kind === "conflict") {
    return (
      <Card title="Nowsza kopia na Dysku Google">
        <p className="small" style={{ marginTop: 0 }}>Na Dysku jest kopia z {stamp(b.savedAt)} zapisana na innym urządzeniu — nowsza niż dane w tym telefonie.</p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => run(async () => { await api.post("/api/backup/restore"); await reloadAfterRestore(); })}>Wczytaj z Dysku</button>
          <button className="btn" disabled={busy} onClick={() => run(async () => { await api.post("/api/backup/keep-local"); reload(); }, "Zostają dane z tego telefonu; kopia na Dysku zaktualizowana.")}>Zostaw dane z telefonu</button>
        </div>
      </Card>
    );
  }
  return (
    <Card title="Kopia na Dysku Google nie działa">
      <p className="small" style={{ marginTop: 0 }}>Ostatnia kopia: {stamp(b.lastSavedAt) ?? "jeszcze żadnej"}. {b.message}</p>
      <button className="btn small" disabled={busy} onClick={() => run(async () => { await api.post("/api/backup/save"); reload(); }, "Zapisano kopię na Dysku.")}>Spróbuj teraz</button>
    </Card>
  );
}

/** Onboarding: start from a copy on Google Drive instead of from scratch. */
export function RestoreFromDrive({ apiKey, athleteId }: { apiKey: string; athleteId: string }) {
  const [url, setUrl] = useState("");
  const { busy, run } = useAction();
  const restore = () => run(async () => {
    if (apiKey.trim()) await api.post("/api/onboarding/icu", { apiKey, athleteId });
    const r = await api.post("/api/backup/restore", { url });
    if (!r.onboarded) throw new Error("Kopia nie zawiera ukończonej konfiguracji.");
    await reloadAfterRestore();
  });
  return (
    <details>
      <summary className="small">Masz kopię na Dysku Google?</summary>
      <p className="small muted">Wklej klucz API powyżej (nie ma go w kopii) i adres skryptu kopii.</p>
      <label className="field"><span>Adres skryptu (…/exec)</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" />
      </label>
      <button className="btn block" disabled={busy || !url.trim()} onClick={() => void restore()}>{busy ? "Wczytuję…" : "Wczytaj kopię"}</button>
    </details>
  );
}
