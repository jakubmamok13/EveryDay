import { useState, useEffect } from "react";
import { useToast } from "./ui";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export async function sendPwaNotification(title: string, body: string): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return false;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon: "./icons/icon-192.png",
          badge: "./icons/icon.svg",
          tag: "morning-reminder",
        } as NotificationOptions);
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: "./icons/icon-192.png",
    });
    return true;
  } catch (e) {
    console.error("Failed to show notification:", e);
    return false;
  }
}

/** Check once per app foreground/session if morning reminder should trigger. */
export function checkMorningReminder(reminderTime: string, checkInDone: boolean): void {
  if (checkInDone || !isNotificationSupported() || Notification.permission !== "granted") return;
  const enabled = localStorage.getItem("morning_reminder_enabled") !== "false";
  if (!enabled) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const lastSent = localStorage.getItem("morning_reminder_last");
  if (lastSent === today) return;

  const [targetH, targetM] = reminderTime.split(":").map(Number);
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  if (currentH > (targetH ?? 7) || (currentH === (targetH ?? 7) && currentM >= (targetM ?? 30))) {
    void sendPwaNotification(
      "EveryDay — Poranna gotowość 🚴",
      "Czas uzupełnić samopoczucie i sprawdzić dzisiejszą odprawę treningową.",
    ).then((sent) => {
      if (sent) localStorage.setItem("morning_reminder_last", today);
    });
  }
}

export function NotificationManager({
  time,
  onTimeChange,
}: {
  time: string;
  onTimeChange: (newTime: string) => void;
}) {
  const toast = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    getNotificationPermission(),
  );
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem("morning_reminder_enabled") !== "false");

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleRequest = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === "granted") {
      toast("Powiadomienia włączone.");
      await sendPwaNotification(
        "EveryDay — Powiadomienia aktywne",
        `Będziemy przypominać o meldunku porannym o ${time}.`,
      );
    } else if (res === "denied") {
      toast("Powiadomienia zostały zablokowane w przeglądarce.");
    }
  };

  const handleTest = async () => {
    if (permission !== "granted") {
      const res = await requestNotificationPermission();
      setPermission(res);
      if (res !== "granted") {
        toast("Najpierw zezwól na powiadomienia w przeglądarce.");
        return;
      }
    }
    const ok = await sendPwaNotification(
      "EveryDay — Test powiadomienia",
      "Powiadomienia działają prawidłowo! Otrzymasz przypomnienie o " + time + ".",
    );
    if (ok) toast("Wysłano powiadomienie testowe.");
    else toast("Nie udało się wysłać powiadomienia.");
  };

  const toggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    localStorage.setItem("morning_reminder_enabled", checked ? "true" : "false");
    toast(checked ? "Włączono przypomnienia." : "Wyłączono przypomnienia.");
  };

  const TIMES = ["06:30", "07:00", "07:30", "08:00", "08:30", "09:00"];

  return (
    <div className="notification-manager" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>Powiadomienia systemowe</strong>
          <div className="tiny muted">
            {permission === "granted"
              ? "Uprawnienia przyznane (PWA)"
              : permission === "denied"
              ? "Zablokowane w ustawieniach przeglądarki"
              : "Wymaga zgody w przeglądarce"}
          </div>
        </div>
        {permission !== "granted" ? (
          <button className="btn small primary" onClick={handleRequest}>
            Zezwól
          </button>
        ) : (
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
            Włączone
          </label>
        )}
      </div>

      <div>
        <span className="small muted" style={{ display: "block", marginBottom: 6 }}>
          Godzina porannego przypomnienia:
        </span>
        <div className="chips">
          {TIMES.map((t) => (
            <button
              key={t}
              className={`btn small${t === time ? " on" : ""}`}
              aria-pressed={t === time}
              onClick={() => onTimeChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn small" onClick={handleTest}>
          Wyślij powiadomienie testowe
        </button>
      </div>

      <ReminderGuide time={time} />
    </div>
  );
}

export function ReminderGuide({ time }: { time: string }) {
  const android = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  return (
    <details className="small muted" style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontWeight: 500 }}>
        Alternatywa: Alarm / Skróty iOS ({time})
      </summary>
      {android ? (
        <ol className="steps-guide" style={{ marginTop: 8 }}>
          <li>Otwórz aplikację <strong>Zegar</strong> i dodaj alarm na <strong>{time}</strong>.</li>
          <li>Nazwij go „EveryDay — check-in”.</li>
          <li>Rano: wyłącz alarm i dotknij ikony <strong>EveryDay</strong> na ekranie początkowym.</li>
        </ol>
      ) : (
        <ol className="steps-guide" style={{ marginTop: 8 }}>
          <li>Otwórz aplikację <strong>Skróty</strong> → zakładka <strong>Automatyzacja</strong> → <strong>+</strong>.</li>
          <li>Wybierz <strong>Pora dnia</strong>: <strong>{time}</strong>, <strong>Codziennie</strong>.</li>
          <li>Zaznacz <strong>Uruchom natychmiast</strong>.</li>
          <li>Dodaj czynność <strong>Pokaż powiadomienie</strong> z tekstem „Czas na poranny check-in 🚴”.</li>
        </ol>
      )}
    </details>
  );
}

export function InstallHint() {
  const standalone =
    (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  if (standalone) return null;
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <p className="small" style={{ background: "var(--accent-soft)", padding: "8px 12px", borderRadius: 12 }}>
      {ios
        ? "Dodaj EveryDay do ekranu początkowego: w Safari Udostępnij → „Do ekranu początkowego”. W iOS 16.4+ powiadomienia PWA działają po dodaniu do ekranu."
        : "Zainstaluj EveryDay: menu przeglądarki → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”. Powiadomienia PWA będą przychodzić bezpośrednio do systemu."}
    </p>
  );
}
