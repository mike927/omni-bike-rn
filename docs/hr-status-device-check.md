# Spójne statusy źródeł tętna — ⏱ ~2 min

## Co sprawdzamy

Home i Settings oddzielają gotowość urządzenia od wyboru źródła tętna. Watch przed treningiem pokazuje `Waiting for ride` / `Start on iPhone`. Nie trzeba rozpoczynać treningu.

Potwierdzone przez agenta: lint i kontrola typów, 107 zestawów / 1016 testów, kompilacja oraz instalacja obu aplikacji. Log iPhone z 4 września 2026, 07:27:02: `emitCompanionState available=true paired=true installed=true activationState=2 reachable=true`. Użytkownik potwierdził poprawne działanie testu na urządzeniach przed zleceniem otwarcia MR.

## Warunki wstępne

Jeśli nie da się potwierdzić warunku, zatrzymaj test i zgłoś problem.

| Do? | Action | Where | Confirm |
| --- | --- | --- | --- |
| ❌ | Reload Metro (JS) | Mac / ten task | Agent uruchamia świeżo zainstalowaną aplikację z bieżącym kodem; Metro działa w tym tasku na porcie 8081. |
| ❌ | Rebuild iPhone app | Mac | Nowy build już skompilowany i zainstalowany przez agenta. |
| ❌ | Rebuild Watch app (matched pair) | Mac | Companion z tego samego buildu już zainstalowany osobno na Watch. |
| ✅ | Otwórz Omni Bike | 📱 aplikacja mobilna | Home wyświetla sekcję `Your gear`. |
| ✅ | Otwórz Omni Bike | ⌚ aplikacja Watch | Zegarek odblokowany, brak aktywnego treningu. |

## Kroki

| # | On | Action | What you should see |
| --- | --- | --- | --- |
| 1 | 📱 aplikacja mobilna | Otwórz Settings | Watch ma osobno `Heart rate · Selected` lub `Not selected` i status gotowości. |
| 2 | 📱 aplikacja mobilna | Wybierz Apple Watch jako źródło tętna | `Selected` i indygowe wyróżnienie na kafelku Watch. |
| 3 | 📱 aplikacja mobilna | Wróć na Home | Watch pokazuje `Selected` oraz tę samą gotowość co Settings. |
| 4 | 📱 aplikacja mobilna | Jeśli masz zapisany czujnik Bluetooth, wybierz go w Settings | Czujnik ma `Selected`, Watch `Not selected`; samo przełączenie nie odbiera Watch statusu `Ready`. Bez czujnika pomiń. |
| 5 | 📱 aplikacja mobilna | Wróć na Home | Wybór zgadza się z Settings, etykieta `Not selected` jest w całości czytelna. |
| 6 | ⌚ aplikacja Watch | Sprawdź ekran przed treningiem | `Waiting for ride` i `Start on iPhone`. |
| 7 | 📱 aplikacja mobilna | Przywróć w Settings preferowane źródło tętna | Właściwe urządzenie ma `Selected`. |

## Kryteria zaliczenia

| Sprawdzenie | Poprawnie | Błąd |
| --- | --- | --- |
| Gotowość | Watch ma ten sam status na Home i w Settings; wybór źródła go nie zmienia | `Off` albo rozbieżne statusy przy niezmienionej dostępności |
| Wybór | Jedno źródło `Selected`, pozostałe `Not selected`; tekst czytelny, może się zawijać | Dwa wybrane źródła lub ucięte oznaczenie wyboru |
| Watch bez treningu | `Waiting for ride` / `Start on iPhone` | Stare `Ready to ride` |

## Co zgłosić

Napisz „gotowe”; przy rozbieżności podaj krok i najlepiej zrzut ekranu. Agent sprawdzi logi połączenia. Same napisy i ich czytelność wymagają potwierdzenia na ekranie — log połączenia ich nie dowodzi.

## Gdy coś nie działa

- Stary napis na Watch: nie resetuj urządzenia; agent sprawdzi uruchomiony build.
- Watch `Unavailable` w obu miejscach: zgłoś to przed testem; agent sprawdzi obecność dopasowanego companionu (`watch-companion-install-mismatch`). Samo uśpienie ekranu nie powinno zmieniać gotowości.
- Telefon pokazuje ekran wyboru serwera: zgłoś problem z Metro; nie trzeba ponownie parować zegarka.
