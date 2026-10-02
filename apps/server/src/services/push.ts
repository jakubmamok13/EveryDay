import webpush from "web-push";
import type { App } from "../app";
import { nowIso } from "../db";
import { plannedActiveOn } from "../repo";

// One web push per day (D-018, D-031). Payload holds only short text, never health data.

export function vapid(app: App): { publicKey: string; privateKey: string } {
  const existing = app.setting<{ publicKey?: string; privateKey?: string }>("vapid", {});
  if (existing.publicKey && existing.privateKey) return existing as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  app.setSetting("vapid", keys);
  return keys;
}

export async function sendToAll(app: App, payload: { title: string; body: string; url?: string }): Promise<number> {
  const acc = app.accountId();
  if (!acc) return 0;
  const keys = vapid(app);
  const email = app.db.get("SELECT email FROM account WHERE id = ?", acc)?.email ?? "everyday@localhost";
  let sent = 0;
  for (const s of app.db.all("SELECT * FROM push_subscription WHERE account_id = ?", acc)) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: `mailto:${email}`, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 6 * 3600 },
      );
      app.db.run("UPDATE push_subscription SET last_success_at = ?, failure_count = 0 WHERE id = ?", nowIso(), s.id);
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) app.db.run("DELETE FROM push_subscription WHERE id = ?", s.id);
      else app.db.run("UPDATE push_subscription SET failure_count = failure_count + 1 WHERE id = ?", s.id);
    }
  }
  return sent;
}

export async function sendDaily(app: App, athleteId: number): Promise<number> {
  const date = app.today();
  if (app.db.get("SELECT 1 FROM notification_log WHERE athlete_id = ? AND date = ?", athleteId, date)) return 0;
  const training = !!plannedActiveOn(app, athleteId, date);
  const conn = app.db.get("SELECT status, last_sync_at FROM source_connection WHERE athlete_id = ?", athleteId);
  const stale = conn?.last_sync_at && Date.now() - Date.parse(conn.last_sync_at) > 24 * 3600_000;
  const body = training
    ? "Dzień dobry! 30 s na check-in, potem plan na dziś."
    : "Dzień wolny. Zrób check-in, sprawdź regenerację.";
  const n = await sendToAll(app, { title: "EveryDay", body: stale ? `${body} (Brak synchronizacji z intervals.icu od wczoraj.)` : body, url: "/" });
  app.db.run("INSERT OR REPLACE INTO notification_log (athlete_id, date, sent_at, devices) VALUES (?,?,?,?)", athleteId, date, nowIso(), n);
  return n;
}
