# Kopia na Dysku Google

Status: **D-068** (rozwiązanie przeniesione z Paragrafu, z osobnym klientem Google dla EveryDay).

Wszystkie dane EveryDay (plan, samopoczucia, oceny jazd, poziomy, sezon, notatki,
ustawienia) same zapisują się w folderze na Twoim Dysku Google. Nowy telefon
po wskazaniu tego folderu zaczyna od tej kopii.

## Jak to działa

- Każde urządzenie ma w folderze **własny plik**
  (`everyday-kopia-<urządzenie>-….json.gz`) i zapisuje tylko ten plik. Dwa
  urządzenia nigdy nie nadpisują tego samego pliku.
- Kopia zapisuje się sama:
  - przy otwarciu aplikacji;
  - przy powrocie do niej po dłuższej przerwie;
  - 20 s po zmianie;
  - przy wyjściu z aplikacji, jeśli coś zostało niezapisane.
  Wysyła się tylko wtedy, gdy dane się zmieniły.
- Gdy **inne urządzenie** zapisało nowszą kopię, aplikacja jej nie nadpisze. Na
  ekranie Dziś zapyta: **Wczytaj z Dysku** albo **Zostaw dane z telefonu**.
  Kopie nie są scalane, bo dwa telefony z EveryDay wysyłałyby treningi do
  intervals.icu jednocześnie.
- Dysk Google pamięta wcześniejsze wersje każdego pliku (Dysk → plik →
  „Zarządzaj wersjami”).
- **Klucz API intervals.icu nie trafia do kopii.** Na nowym telefonie wklejasz
  go w Ustawienia › intervals.icu.
- Uprawnienie to `drive.file`: aplikacja widzi **tylko pliki i foldery, które
  sama utworzyła**, nie resztę Twojego Dysku. Dane idą prosto z telefonu na
  Twój Dysk, bez serwera pośredniego.

## Jednorazowa konfiguracja (ok. 5 minut, na komputerze)

EveryDay ma **własnego klienta Google**, osobnego od Paragrafu. Tworzysz go raz,
za darmo, na swoim koncie Google. Możesz użyć tego samego projektu Google
Cloud co Paragraf (krok 1–4 są już zrobione), albo utworzyć nowy.

1. Nowy projekt: <https://console.cloud.google.com/projectcreate>, np. „EveryDay”.
2. Włącz Drive API: <https://console.cloud.google.com/apis/library/drive.googleapis.com>
   → **Włącz**.
3. <https://console.cloud.google.com/auth/overview> → **Rozpocznij**:
   - Nazwa aplikacji: EveryDay. E-mail pomocy: Twój.
   - Odbiorcy: **Zewnętrzni**. E-mail kontaktowy: Twój. Zaakceptuj zasady.
4. **Odbiorcy** (Audience) → **Użytkownicy testowi** → dodaj swój adres Gmail.
   Możesz też kliknąć „Opublikuj aplikację”: zakres `drive.file` nie wymaga
   weryfikacji przez Google.
5. **Klienci** (Clients) → **Utwórz klienta**:
   - Typ: **Aplikacja internetowa**, nazwa np. „EveryDay”.
   - Autoryzowane źródła JavaScript: `https://jakubmamok13.github.io`
   - Autoryzowane identyfikatory URI przekierowania:
     `https://jakubmamok13.github.io/EveryDay/` — z ukośnikiem na końcu
     (dokładny adres pokazuje też aplikacja w Ustawieniach).
6. Skopiuj **identyfikator klienta** (kończy się na
   `.apps.googleusercontent.com`) i wybierz jedno z dwóch:
   - **Raz, wbudowany w aplikację.** W repozytorium EveryDay na GitHubie:
     Settings → Secrets and variables → Actions → **Variables** → New repository
     variable. Nazwa: `GOOGLE_CLIENT_ID`, wartość: identyfikator. Potem uruchom
     ponownie akcję „Publish to GitHub Pages” (Actions → Run workflow).
   - **Na telefonie.** Wklej identyfikator w aplikacji: Ustawienia › Kopia na
     Dysku Google.

Przy pierwszym logowaniu Google może pokazać ekran „Google nie zweryfikował tej
aplikacji”. To Twoja własna aplikacja, więc wybierz „Kontynuuj”.

## Pierwszy telefon

Ustawienia › **Kopia na Dysku Google** › **Połącz z Dyskiem Google** › zaloguj
się › **Utwórz folder** (domyślnie „EveryDay”). Kopia telefonu od razu trafia do
folderu. Folder możesz potem przenieść w dowolne miejsce na Dysku.

## Nowy telefon

1. Otwórz aplikację w Safari i dodaj ją do ekranu początkowego; dalej używaj ikony.
2. Na pierwszym ekranie: **Masz kopię na Dysku Google?** › Zaloguj do Dysku
   Google › przy folderze EveryDay **Użyj tego folderu**.
3. Wszystko się wczyta. Wklej klucz API intervals.icu w Ustawienia ›
   intervals.icu (aplikacja o tym przypomni na ekranie Dziś).

## Logowanie

Dostęp od Google ważny jest godzinę. Po tym czasie aplikacja przy otwarciu na
moment przechodzi do Google i wraca z nowym dostępem, bez klikania. Jeśli Google
chce potwierdzenia (np. wylogowałeś się z konta), na ekranie Dziś pojawia się
przycisk **Zaloguj do Dysku Google**. Do tego czasu wszystko działa normalnie
na telefonie, a kopia zapisze się po zalogowaniu.

## Odłączenie

Ustawienia › Kopia na Dysku Google › **Odłącz**. Dane zostają i w telefonie, i w
folderze; kopia po prostu przestaje się zapisywać.

## Gdy coś nie działa

**„Błąd 401: invalid_client”** – Google nie zna wysłanego identyfikatora klienta.

1. W aplikacji: Ustawienia › Kopia na Dysku Google › „Identyfikator klienta
   Google”. Porównaj go znak po znaku z Google Cloud → Google Auth Platform →
   **Klienci**.
2. Musi to być **identyfikator** (`…-….apps.googleusercontent.com`), nie
   **sekret** (`GOCSPX-…`). Aplikacja odrzuca sekret i sama usuwa spacje, znaki
   nowej linii i dopiski typu „Client ID:”.
3. Jeśli identyfikator jest wbudowany przez zmienną `GOOGLE_CLIENT_ID`,
   sprawdź jej wartość. Identyfikator wpisany w aplikacji zastępuje wbudowany na
   tym telefonie.
4. Klient musi być typu **Aplikacja internetowa** i należeć do projektu, który
   nie jest usunięty. Nowy klient może zacząć działać dopiero po kilku minutach.

**„Błąd 400: redirect_uri_mismatch”** – adres powrotu w kliencie Google różni się
od adresu aplikacji. Skopiuj oba adresy z aplikacji (Ustawienia › Kopia na
Dysku Google › „Identyfikator klienta Google”) do pól „Autoryzowane źródła
JavaScript” i „Autoryzowane identyfikatory URI przekierowania”. Uwaga: klient
Paragrafu ma adres `…/paragraf/` — EveryDay potrzebuje `…/EveryDay/`.

**„Błąd 403: access_denied”** – Twoje konto nie jest na liście użytkowników
testowych (Google Auth Platform → Odbiorcy). Dodaj je albo opublikuj aplikację.
