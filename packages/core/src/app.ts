import { localDateTime, type ISODate } from "@everyday/shared";
import { Db, nowIso } from "./db";
import { FakeIcuClient } from "./fake-icu";
import { RealIcuClient, type IcuClient } from "./icu";
import type { BackupStore } from "./services/backup";

// The app runs entirely on the phone (D-043): this object ties the local
// database, the intervals.icu client and the bundled coaching notes together.

export interface Note {
  path: string;
  text: string;
}

export interface Config {
  demo: boolean;
  timeZone: string;
  /** Method Notes bundled with the app (Knowledge Base). */
  notes: Note[];
}

export class App {
  private icuClient: IcuClient | null = null;
  /** For tests and demo: override "now". */
  clock: () => Date = () => new Date();
  /** Google Drive for the copy (D-068): set by the web app, a stand-in in tests. */
  backupStore?: BackupStore;

  constructor(readonly config: Config, readonly db: Db) {}

  now(): { date: ISODate; time: string; minutes: number } {
    return localDateTime(this.clock(), this.config.timeZone);
  }
  today(): ISODate {
    return this.now().date;
  }

  // ---------- the one local profile ----------

  accountId(): number {
    const id = this.db.get<{ id: number }>("SELECT id FROM account ORDER BY id LIMIT 1")?.id;
    if (id) return id;
    return this.db.tx(() => {
      const acc = this.db.run("INSERT INTO account (email, password_hash, created_at) VALUES ('local', '', ?)", nowIso()).id;
      this.db.run("INSERT INTO athlete (account_id, created_at) VALUES (?, ?)", acc, nowIso());
      return acc;
    });
  }
  athleteId(): number {
    this.accountId();
    return this.db.get<{ id: number }>("SELECT id FROM athlete ORDER BY id LIMIT 1")!.id;
  }
  requireAthlete(): number {
    return this.athleteId();
  }
  onboarded(): boolean {
    return !!this.db.get("SELECT onboarded FROM athlete WHERE onboarded = 1 LIMIT 1");
  }

  // ---------- settings ----------

  setting<T>(key: string, fallback: T): T {
    const row = this.db.get<{ value_json: string }>("SELECT value_json FROM setting WHERE account_id = ? AND key = ?", this.accountId(), key);
    return row ? ({ ...((fallback as object) ?? {}), ...JSON.parse(row.value_json) } as T) : fallback;
  }
  setSetting(key: string, value: unknown): void {
    this.db.run(
      "INSERT INTO setting (account_id, key, value_json) VALUES (?, ?, ?) ON CONFLICT(account_id, key) DO UPDATE SET value_json = excluded.value_json",
      this.accountId(), key, JSON.stringify(value),
    );
  }

  // ---------- intervals.icu ----------

  icu(): IcuClient | null {
    if (this.config.demo) {
      this.icuClient ??= new FakeIcuClient(() => this.today());
      return this.icuClient;
    }
    const row = this.db.get<{ api_key_encrypted: string | null; external_athlete_id: string | null }>(
      "SELECT api_key_encrypted, external_athlete_id FROM source_connection WHERE athlete_id = ? AND provider = 'intervals_icu'",
      this.athleteId(),
    );
    if (!row?.api_key_encrypted) return null;
    // The key never leaves this phone except in requests to intervals.icu.
    this.icuClient ??= new RealIcuClient(row.api_key_encrypted, row.external_athlete_id || "0");
    return this.icuClient;
  }
  resetIcu(): void {
    this.icuClient = null;
  }
}
