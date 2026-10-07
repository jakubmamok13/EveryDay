import { useEffect, useState } from "react";
import type { DriveCopy } from "@everyday/core";
import { api } from "./api";
import {
  clientId,
  clientIdProblem,
  clientIdSource,
  createFolder,
  driveConfig,
  driveLinked,
  forgetDrive,
  GUIDE,
  hasToken,
  listFolders,
  normalizeClientId,
  redirectUri,
  saveDriveConfig,
  signIn,
  type DriveFile,
} from "./drive";
import { runtime } from "./runtime";
import { Card, useAction, useToast } from "./ui";

// Copy in a folder on the athlete's Google Drive (D-068, ported from Paragraf).

const stamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

/** After a restore the whole app starts again from the restored data. */
async function reloadAfterRestore() {
  await (await runtime()).flush();
  location.reload();
}

/** Google's "Błąd 401: invalid_client" means it does not know the ID that was sent. */
function InvalidClientHint() {
  return (
    <p className="tiny muted">
      Google pokazuje „Błąd 401: invalid_client”? Google nie zna wysłanego identyfikatora. Porównaj go z Google Cloud › Google Auth Platform › Klienci.
      Musi to być <strong>identyfikator klienta</strong>, nie sekret („GOCSPX-…”). Nowy klient może zacząć działać dopiero po kilku minutach.
    </p>
  );
}

/** The OAuth client ID: shown, checked and changeable on the device (also when built into the published app). */
function ClientSetup({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const source = clientIdSource();
  const [value, setValue] = useState(driveConfig().clientId || clientId());
  const save = () => {
    const problem = clientIdProblem(value);
    if (problem) return toast(problem);
    const id = normalizeClientId(value);
    setValue(id);
    saveDriveConfig({ clientId: id, token: null, tokenExpires: 0 });
    toast(id ? "Zapisano identyfikator klienta." : "Usunięto identyfikator wpisany na tym urządzeniu.");
    onChange();
  };
  return (
    <div className="stack">
      <label className="field"><span>Adres powrotu („Autoryzowane identyfikatory URI przekierowania”, z ukośnikiem na końcu)</span>
        <input readOnly value={redirectUri()} onFocus={(e) => e.target.select()} />
      </label>
      <label className="field"><span>Źródło JavaScript („Autoryzowane źródła JavaScript”, bez ukośnika)</span>
        <input readOnly value={location.origin} onFocus={(e) => e.target.select()} />
      </label>
      <label className="field"><span>{source === "build" ? "Identyfikator klienta OAuth (wbudowany w aplikację; wpisz inny, żeby go zastąpić na tym telefonie)" : "Identyfikator klienta OAuth (kończy się na .apps.googleusercontent.com)"}</span>
        <input value={value} placeholder="1234567890-abc123.apps.googleusercontent.com" onChange={(e) => setValue(e.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      </label>
      <div><button className="btn small" onClick={save}>Zapisz identyfikator</button></div>
    </div>
  );
}

/** Folders the app created on any of your devices (the only ones it can see), or a new one. */
function FolderPicker({ allowCreate, onChosen }: { allowCreate: boolean; onChosen: (f: Pick<DriveFile, "id" | "name">) => Promise<void> }) {
  const [folders, setFolders] = useState<DriveFile[] | null>(null);
  const [name, setName] = useState("EveryDay");
  const { busy, run } = useAction();
  useEffect(() => {
    void run(async () => setFolders(await listFolders()));
  }, []);
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        {allowCreate ? "Wybierz folder, którego używa Twoje inne urządzenie, albo utwórz nowy." : "Wybierz folder z kopią EveryDay."} Aplikacja widzi tylko foldery i pliki, które sama
        utworzyła, nie resztę Twojego Dysku.
      </p>
      {folders === null && <p className="small muted">Szukam folderów…</p>}
      {folders?.length === 0 && <p className="small muted">Nie ma jeszcze folderu EveryDay na Twoim Dysku.</p>}
      {folders?.map((f) => (
        <div key={f.id} className="drive-row">
          <span>📁 {f.name}</span>
          <button className="btn small primary" disabled={busy} onClick={() => void run(() => onChosen(f))}>Użyj tego folderu</button>
        </div>
      ))}
      {allowCreate && (
        <div className="row">
          <input className="inline-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nazwa nowego folderu" />
          <button className="btn" disabled={busy || !name.trim()} onClick={() => void run(async () => onChosen(await createFolder(name.trim())))}>Utwórz folder</button>
        </div>
      )}
    </div>
  );
}

const useRerender = () => {
  const [, set] = useState(0);
  return () => set((n) => n + 1);
};

/** Settings › Kopia na Dysku Google. */
export function DriveBackupCard({ demo }: { demo: boolean }) {
  const rerender = useRerender();
  const [st, setSt] = useState<any>(null);
  const [copies, setCopies] = useState<(DriveCopy & { own: boolean })[] | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const { busy, run } = useAction();
  const toast = useToast();
  const cfg = driveConfig();
  const linked = driveLinked();
  const signedIn = hasToken();

  const loadStatus = async () => {
    setSt(await api.get("/api/backup"));
    if (driveLinked() && hasToken()) setCopies((await api.get("/api/backup/copies")).copies);
  };
  useEffect(() => {
    if (!demo) void loadStatus().catch((e: Error) => toast(e.message));
  }, [demo, linked, signedIn]);

  if (demo) {
    return (
      <Card title="Kopia na Dysku Google">
        <p className="small muted" style={{ margin: 0 }}>W trybie demo kopia jest wyłączona.</p>
      </Card>
    );
  }

  const intro = (
    <p className="small" style={{ marginTop: 0 }}>
      Dane są w tym telefonie; usunięcie ikony aplikacji albo nowy telefon je kasuje. Z kopią w folderze na Twoim Dysku Google aplikacja zapisuje wszystko
      sama, a nowy telefon zaczyna od tej kopii. Klucz API intervals.icu nie trafia do kopii.
    </p>
  );

  const chosen = async (f: Pick<DriveFile, "id" | "name">) => {
    saveDriveConfig({ folderId: f.id, folderName: f.name, ownFileId: null });
    const r = await api.post("/api/backup/folder-chosen");
    setSt(r.status);
    if (r.state === "saved") toast(`Folder „${f.name}” połączony. Kopia tego telefonu jest już na Dysku.`);
    if (r.state === "exists") toast(`W folderze jest kopia z urządzenia „${r.copy.deviceName}”. Wybierz niżej, które dane zostają.`);
    rerender();
    await loadStatus();
  };

  let body;
  if (!clientId()) {
    body = (
      <>
        {intro}
        <p className="small">
          Potrzebny jest jednorazowo identyfikator klienta Google — osobny dla EveryDay (ok. 5 minut,{" "}
          <a href={GUIDE} target="_blank" rel="noreferrer">instrukcja</a>).
        </p>
        <ClientSetup onChange={rerender} />
      </>
    );
  } else if (!linked) {
    body = signedIn ? (
      <FolderPicker allowCreate onChosen={chosen} />
    ) : (
      <div className="stack">
        {intro}
        <p className="small muted" style={{ margin: 0 }}>Aplikacja dostanie dostęp wyłącznie do plików, które sama utworzy (uprawnienie „drive.file”).</p>
        <button className="btn primary" disabled={busy} onClick={() => void run(() => signIn(true, "settings"))}>Połącz z Dyskiem Google</button>
        <InvalidClientHint />
        <details>
          <summary className="small">Identyfikator klienta Google</summary>
          <ClientSetup onChange={rerender} />
        </details>
      </div>
    );
  } else {
    const conflict: DriveCopy | null = st?.conflict ?? null;
    body = (
      <div className="stack">
        <p className="small" style={{ margin: 0 }}>
          Folder: <strong>📁 {cfg.folderName}</strong>
          {cfg.email && <span className="muted"> · {cfg.email}</span>}
        </p>
        {conflict && (
          <div className="stack notice">
            <p className="small" style={{ margin: 0 }}>W folderze jest nowsza kopia z urządzenia „{conflict.deviceName}” ({stamp(conflict.modifiedTime)}). Które dane mają zostać?</p>
            <button className="btn primary" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/restore", { id: conflict.id }); await reloadAfterRestore(); })}>Wczytaj kopię z „{conflict.deviceName}”</button>
            <button className="btn" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/keep-local"); await loadStatus(); }, "Zostają dane z tego telefonu; jego kopia jest na Dysku.")}>Zostaw dane z tego telefonu</button>
          </div>
        )}
        <p className={`small ${st?.error ? "warn" : "muted"}`} style={{ margin: 0 }} data-backup={st?.lastSavedAt ?? ""}>
          {!signedIn
            ? "Trzeba zalogować się ponownie — na telefonie nic nie ginie."
            : st?.error
              ? `Ostatnia próba (${stamp(st.error.at)}) nieudana: ${st.error.message}`
              : `Ostatnia kopia: ${stamp(st?.lastSavedAt) ?? "jeszcze żadnej"}. Zapisuje się sama po zmianach i przy otwarciu.`}
        </p>
        {copies && copies.length > 0 && (
          <div>
            {copies.map((c) => (
              <div key={c.id} className="drive-row small">
                <span>💾 {c.deviceName}{c.own && <span className="muted"> (ten telefon)</span>}</span>
                <span className="muted">{stamp(c.modifiedTime)}</span>
                {!c.own && (restoreId === c.id ? (
                  <span className="row">
                    <button className="btn small primary" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/restore", { id: c.id }); await reloadAfterRestore(); })}>Tak, zastąp dane</button>
                    <button className="btn small" onClick={() => setRestoreId(null)}>Nie</button>
                  </span>
                ) : (
                  <button className="linkbtn" onClick={() => setRestoreId(c.id)}>Wczytaj…</button>
                ))}
              </div>
            ))}
          </div>
        )}
        <label className="field" style={{ marginBottom: 0 }}><span>Nazwa tego telefonu (tak nazywa się jego plik w folderze)</span>
          <input defaultValue={cfg.deviceName} onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== cfg.deviceName) {
              saveDriveConfig({ deviceName: v });
              if (hasToken()) void run(async () => { await api.post("/api/backup/save"); await loadStatus(); });
            }
          }} />
        </label>
        <div className="row">
          {signedIn ? (
            <button className="btn" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/save"); await loadStatus(); }, "Zapisano kopię na Dysku.")}>Zapisz kopię teraz</button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={() => void run(() => signIn(true, "settings"))}>Zaloguj do Dysku Google</button>
          )}
        </div>
        {!confirmOff ? (
          <button className="linkbtn" onClick={() => setConfirmOff(true)}>Odłącz</button>
        ) : (
          <div className="row">
            <span className="small">Odłączyć? Dane zostają i w telefonie, i na Dysku.</span>
            <button className="btn small" onClick={() => void run(async () => { forgetDrive(); await api.del("/api/backup"); setConfirmOff(false); setCopies(null); rerender(); }, "Odłączono. Kopie na Dysku zostają.")}>Odłącz</button>
            <button className="btn small ghost" onClick={() => setConfirmOff(false)}>Nie</button>
          </div>
        )}
        {!signedIn && <InvalidClientHint />}
        <details>
          <summary className="small">Identyfikator klienta Google</summary>
          <ClientSetup onChange={rerender} />
        </details>
      </div>
    );
  }
  return <Card title="Kopia na Dysku Google">{body}</Card>;
}

/** Today: sign in again, a newer copy from another device, or no copy for a week. */
export function BackupNoticeCard({ b, demo, reload }: { b: any; demo: boolean; reload: () => void }) {
  const { busy, run } = useAction();
  if (demo) return null;
  if (driveLinked() && !hasToken() && driveConfig().needsLogin) {
    return (
      <Card title="Kopia na Dysku Google">
        <p className="small" style={{ marginTop: 0 }}>Zaloguj się ponownie, żeby kopia dalej się zapisywała. Na telefonie nic nie ginie.</p>
        <button className="btn small" disabled={busy} onClick={() => void run(() => signIn(true))}>Zaloguj do Dysku Google</button>
      </Card>
    );
  }
  if (!b) return null;
  if (b.kind === "conflict") {
    return (
      <Card title="Nowsza kopia na Dysku Google">
        <p className="small" style={{ marginTop: 0 }}>Urządzenie „{b.deviceName}” zapisało kopię {stamp(b.savedAt)} — nowszą niż dane w tym telefonie. Które dane mają zostać?</p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/restore"); await reloadAfterRestore(); })}>Wczytaj z Dysku</button>
          <button className="btn" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/keep-local"); reload(); }, "Zostają dane z tego telefonu; jego kopia jest na Dysku.")}>Zostaw dane z telefonu</button>
        </div>
      </Card>
    );
  }
  return (
    <Card title="Kopia na Dysku Google nie działa">
      <p className="small" style={{ marginTop: 0 }}>Ostatnia kopia: {stamp(b.lastSavedAt) ?? "jeszcze żadnej"}. {b.message}</p>
      <button className="btn small" disabled={busy} onClick={() => void run(async () => { await api.post("/api/backup/save"); reload(); }, "Zapisano kopię na Dysku.")}>Spróbuj teraz</button>
    </Card>
  );
}

/** Onboarding: start from a copy on Google Drive instead of from scratch. */
export function RestoreFromDrive() {
  const rerender = useRerender();
  const { busy, run } = useAction();
  const toast = useToast();
  const signedIn = hasToken();
  const chosen = async (f: Pick<DriveFile, "id" | "name">) => {
    saveDriveConfig({ folderId: f.id, folderName: f.name, ownFileId: null });
    const r = await api.post("/api/backup/folder-chosen");
    if (r.state === "restored") return reloadAfterRestore();
    saveDriveConfig({ folderId: null, folderName: null });
    toast(`W folderze „${f.name}” nie ma kopii EveryDay.`);
  };
  return (
    <details open={signedIn}>
      <summary className="small">Masz kopię na Dysku Google?</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        {!clientId() ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>Potrzebny jest identyfikator klienta Google (<a href={GUIDE} target="_blank" rel="noreferrer">instrukcja</a>).</p>
            <ClientSetup onChange={rerender} />
          </>
        ) : signedIn ? (
          <FolderPicker allowCreate={false} onChosen={chosen} />
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>Zaloguj się do Google i wskaż folder z kopią. Klucz API intervals.icu wkleisz potem w Ustawieniach (nie ma go w kopii).</p>
            <button className="btn block" disabled={busy} onClick={() => void run(() => signIn(true))}>Zaloguj do Dysku Google</button>
            <InvalidClientHint />
          </>
        )}
      </div>
    </details>
  );
}
