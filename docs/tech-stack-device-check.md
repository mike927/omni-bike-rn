# Test aktualizacji stacku — ⏱ ~6 min po przygotowaniu urządzeń

## Co sprawdzamy

Czy po aktualizacji Expo/React Native działają połączenie z rowerem, tętno z Watch, sterowanie treningiem, praca w tle i zapis wyników. Test zapisze krótki trening testowy; nie wysyłaj go do Stravy.

## Warunki wstępne

Jeśli któregokolwiek warunku nie da się potwierdzić, zatrzymaj test. Najpierw naprawiamy przygotowanie urządzeń.

| Do? | Action | Where | Confirm |
| --- | --- | --- | --- |
| ❌ | Reload Metro (JS) | Mac | Osobne odświeżenie niepotrzebne: serwer aktualnej gałęzi został uruchomiony na 8081. Jeśli został zamknięty, agent uruchamia go ponownie. |
| ❌ | Rebuild iPhone app | Mac | Aktualny build jest już zainstalowany; problem dotyczy uruchomienia, nie kompilacji. |
| ❌ | Rebuild Watch app (matched pair) | Mac | Dopasowany companion został zainstalowany i uruchomiony. iPhone potwierdza `paired=true installed=true available=true`. |
| ❌ | Potwierdź zaufanie do własnego profilu deweloperskiego | iPhone → systemowe Ustawienia → Ogólne → VPN i zarządzanie urządzeniem | Wykonane: po potwierdzeniu użytkownika agent uruchomił Omni Bike i załadował aktualny bundle. |
| ✅ | Odblokuj iPhone i Watch oraz podłącz iPhone do Maca | Urządzenia fizyczne | Zaakceptuj zaufanie do własnego Maca, jeśli pojawi się pytanie. |
| ❌ | Potwierdź połączenie instalacyjne z Watch | Ten task | Wykonane: po ponownym połączeniu w Xcode instalacja i uruchomienie zakończyły się sukcesem. Można przejść do testu po spełnieniu pozostałych warunków. |
| ✅ | Uruchom Omni Bike na obu urządzeniach | Aplikacja mobilna i aplikacja Watch | Telefon pokazuje Home, Watch nie jest „Unavailable”. |
| ✅ | Przygotuj zapisany rower i wybierz Watch jako źródło tętna | Aplikacja mobilna → Settings → My Gear | Rower jest dostępny, Watch wybrany. Załóż zegarek i obudź rower. |
| ✅ | Sprawdź połączenie Apple Health | Aplikacja mobilna → Settings → Integrations | Apple Health połączone, ze zgodą na zapis treningów. |

## Kroki

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 1 | 📱 aplikacja mobilna | Otwórz History | Dotychczasowe treningi nadal są widoczne. |
| 2 | 📱 aplikacja mobilna | Rozpocznij trening z Home | Otwiera się ekran treningu. |
| 3 | 🤚 fizycznie | Pedałuj przez około minutę | Moc/kadencja aktualizują się na telefonie, pojawia się tętno z Watch. |
| 4 | ⌚ aplikacja Watch | Wstrzymaj trening | Telefon i zegarek pokazują pauzę. |
| 5 | ⌚ aplikacja Watch | Wznów trening | Oba urządzenia wracają do aktywnego treningu. |
| 6 | 📱 aplikacja mobilna | Przełącz telefon na ekran główny na 30 sekund, nadal pedałując | Trening na Watch pozostaje aktywny. |
| 7 | 📱 aplikacja mobilna | Wróć do Omni Bike | Trening trwa; dane i tętno odświeżają się. |
| 8 | 📱 aplikacja mobilna | Naciśnij Finish | Pojawia się podsumowanie, Watch kończy trening. |
| 9 | 📱 aplikacja mobilna | Naciśnij Save | Trening trafia do lokalnej historii. |
| 10 | 📱 aplikacja mobilna | Otwórz zapisany trening i wybierz zapis do Apple Health | Aplikacja potwierdza zapis bez błędu. |
| 11 | 📱 systemowa aplikacja Zdrowie | Sprawdź nowy trening | Widoczna jazda indoor z odpowiadającym czasem i metrykami. |

## Kryteria zaliczenia

| Sprawdzenie | Poprawnie | Błąd |
| --- | --- | --- |
| Dane po aktualizacji | Dotychczasowa historia i ustawienia zachowane | Historia znika lub aplikacja nie startuje |
| BLE i HR | Żywe metryki roweru i tętno z Watch | Zamrożone dane, stałe „No signal”, błędne źródło tętna |
| Watch i tło | Pauza/wznowienie zgodne na obu urządzeniach; po powrocie dane wracają | Rozbieżne stany, drugi trening, brak aktualizacji |
| Zapis | Trening w historii i potwierdzony zapis do Apple Health | Błąd zapisu, brak treningu lub duplikacja przez jedną akcję zapisu |

## Co zgłosić

Napisz „gotowe” i podaj numer kroku, jeśli coś było niezgodne z opisem. Agent pobierze dostępne logi z urządzeń i sprawdzi je; nie musisz uruchamiać poleceń ani czytać logów.

## Gdy coś nie działa

- Komunikat bezpieczeństwa iOS: zatrzymaj się na warunkach wstępnych. Podpisy obu plików aplikacji są lokalnie poprawne, ale zaufanie do profilu na urządzeniu wymaga potwierdzenia. [Instrukcja Apple](https://help.apple.com/xcode/mac/current/en.lproj/dev96a12fb84.html).
- Watch „Unavailable”: nie kontynuuj treningu; najpierw potwierdzamy instalację dopasowanego companionu (znany problem `watch-companion-install-mismatch`).
- Watch odrzuca połączenie z Maca: pozostaw iPhone podłączony, oba urządzenia odblokowane; sprawdzimy parowanie w Xcode. Nie resetuj zegarka ani jego danych.
- Telefon nie łączy się z serwerem: oba urządzenia powinny mieć dostęp do tej samej sieci; zgłoś problem, agent sprawdzi Metro.
