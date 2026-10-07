/**
 * EveryDay — kopia danych na Twoim Dysku Google (D-067).
 *
 * Wklej ten kod w nowy projekt na https://script.google.com, potem:
 * Wdróż › Nowe wdrożenie › typ „Aplikacja internetowa”,
 * „Wykonaj jako: Ja”, „Kto ma dostęp: Każdy” › Wdróż › skopiuj adres URL
 * (kończy się na /exec) i wklej go w EveryDay › Ustawienia › Kopia na Dysku Google.
 *
 * Skrypt działa na Twoim koncie i zapisuje pliki w folderze „EveryDay”
 * na Twoim Dysku:
 *   everyday-kopia.json        — najnowsza kopia (aplikacja ją czyta i nadpisuje),
 *   everyday-RRRR-MM-DD.json   — kopia z każdego dnia, 14 ostatnich dni.
 * Każdy, kto zna adres /exec, może kopię odczytać i nadpisać — nie udostępniaj go.
 */

const FOLDER_NAME = 'EveryDay';
const LATEST = 'everyday-kopia.json';
const KEEP_DAILY = 14;

/** GET ?op=meta → data ostatniej kopii; GET ?op=load → cała kopia. */
function doGet(e) {
  const op = (e && e.parameter && e.parameter.op) || 'meta';
  const file = findFile_(LATEST);
  if (!file) return out_({ ok: true, empty: true });
  const meta = readMeta_(file);
  if (op === 'load') {
    const env = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    return out_({ ok: true, savedAt: env.savedAt, device: env.device, data: env.data });
  }
  return out_({ ok: true, savedAt: meta.savedAt || null, device: meta.device || null, size: file.getSize() });
}

/** POST {op: "save", device, savedAt, data} → zapisuje kopię (treść jako text/plain). */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.op !== 'save' || !body.data || body.data.app !== 'everyday' || !body.savedAt) {
      return out_({ ok: false, error: 'To nie jest kopia EveryDay.' });
    }
    const env = JSON.stringify({ app: 'everyday-backup', version: 1, savedAt: body.savedAt, device: body.device || null, data: body.data });
    const meta = JSON.stringify({ savedAt: body.savedAt, device: body.device || null });
    upsert_(LATEST, env, meta);
    upsert_('everyday-' + String(body.savedAt).slice(0, 10) + '.json', env, meta);
    pruneDaily_();
    return out_({ ok: true, savedAt: body.savedAt });
  } catch (err) {
    return out_({ ok: false, error: 'Błąd skryptu: ' + err });
  } finally {
    lock.releaseLock();
  }
}

function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function findFile_(name) {
  const it = folder_().getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function readMeta_(file) {
  try {
    return JSON.parse(file.getDescription() || '{}');
  } catch (err) {
    return {};
  }
}

function upsert_(name, content, meta) {
  const file = findFile_(name);
  if (file) {
    try {
      file.setContent(content);
      file.setDescription(meta);
      return;
    } catch (err) {
      file.setTrashed(true); // very large content: replace the file instead
    }
  }
  folder_().createFile(name, content, MimeType.PLAIN_TEXT).setDescription(meta);
}

function pruneDaily_() {
  const daily = [];
  const it = folder_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (/^everyday-\d{4}-\d{2}-\d{2}\.json$/.test(f.getName())) daily.push(f);
  }
  daily.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  daily.slice(KEEP_DAILY).forEach(function (f) { f.setTrashed(true); });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
