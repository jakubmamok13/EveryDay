// Morning reminder without a server (D-045): an iPhone Shortcuts automation
// shows a notification; tapping the EveryDay icon opens the check-in.

export function ReminderGuide({ time }: { time: string }) {
  const android = /android/i.test(navigator.userAgent);
  return android ? (
    <ol className="steps-guide">
      <li>Otwórz aplikację <strong>Zegar</strong> i dodaj alarm na <strong>{time}</strong>.</li>
      <li>Nazwij go „EveryDay — check-in”.</li>
      <li>Rano: wyłącz alarm i dotknij ikony <strong>EveryDay</strong> na ekranie początkowym.</li>
    </ol>
  ) : (
    <ol className="steps-guide">
      <li>Otwórz aplikację <strong>Skróty</strong> → zakładka <strong>Automatyzacja</strong> → <strong>+</strong>.</li>
      <li>Wybierz <strong>Pora dnia</strong>: <strong>{time}</strong>, <strong>Codziennie</strong> (albo tylko w dni treningowe).</li>
      <li>Zaznacz <strong>Uruchom natychmiast</strong>.</li>
      <li>Dodaj czynność <strong>Pokaż powiadomienie</strong> z tekstem „Czas na poranny check-in 🚴”.</li>
      <li>Rano: dotknij powiadomienia, potem ikony <strong>EveryDay</strong> na ekranie początkowym.</li>
    </ol>
  );
}

export function InstallHint() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <p className="small" style={{ background: "var(--accent-soft)", padding: "8px 12px", borderRadius: 12 }}>
      {ios
        ? "Dodaj EveryDay do ekranu początkowego: w Safari Udostępnij → „Do ekranu początkowego”. Potem otwieraj aplikację tylko z ikony — tam są Twoje dane."
        : "Zainstaluj EveryDay: menu przeglądarki → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”. Potem otwieraj ją z ikony."}
    </p>
  );
}
