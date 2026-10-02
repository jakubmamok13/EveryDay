import { api } from "./api";

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission and register this device for the daily notification (D-018). */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) {
    return isIos() && !isStandalone()
      ? "Na iPhonie najpierw dodaj aplikację do ekranu początkowego (Udostępnij → Do ekranu początkowego), potem otwórz ją stamtąd."
      : "Ta przeglądarka nie obsługuje powiadomień.";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Brak zgody na powiadomienia.";
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.get<{ publicKey: string }>("/api/push/vapid");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  await api.post("/api/push/subscribe", { subscription: sub.toJSON(), platform: isIos() ? "ios" : /android/i.test(navigator.userAgent) ? "android" : "desktop" });
  return "Powiadomienia włączone na tym urządzeniu.";
}
