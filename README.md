# Unia Janikowo — Wyniki Meczów

Automatyczne pobieranie wyników MKS Janikowo z laczynaspilka.pl co 6 godzin.

## Jak to działa

```
GitHub Actions (co 6h)
  → Puppeteer odwiedza stronę PZPN
  → Przechwytuje dane API
  → Zapisuje data/matches.json do repo

WordPress
  → Pobiera data/matches.json (publiczny URL)
  → Wyświetla przez shortcode [unia_mecze]
```

## Instalacja

### 1. GitHub — utwórz repo

1. Zaloguj się na github.com
2. **New repository** → nazwa np. `unia-janikowo-wyniki`
3. Ustaw jako **Public** (żeby WordPress mógł pobrać JSON)
4. Wgraj wszystkie pliki z tego folderu

### 2. GitHub — włącz uprawnienia Actions

1. W repo → **Settings** → **Actions** → **General**
2. W sekcji "Workflow permissions" wybierz **Read and write permissions**
3. Zapisz

### 3. WordPress — zainstaluj plugin

1. wp-admin → **Plugins** → **Add New** → **Upload Plugin**
2. Wgraj plik `unia-janikowo-matches.php`
3. Aktywuj plugin
4. **Otwórz plik pluginu** i zmień linię:
   ```php
   define( 'UNIA_GITHUB_REPO', 'TWOJA_NAZWA/TWOJE_REPO' );
   ```
   na np.:
   ```php
   define( 'UNIA_GITHUB_REPO', 'jankowalski/unia-janikowo-wyniki' );
   ```

### 4. Pierwsze uruchomienie scrapera

1. W repo na GitHubie → **Actions** → **Pobierz wyniki PZPN**
2. Kliknij **Run workflow** → **Run workflow**
3. Poczekaj ~2 minuty
4. Sprawdź czy plik `data/matches.json` ma dane

### 5. Bricks — dodaj widget

W dowolnym miejscu strony dodaj element **Shortcode** i wpisz:

```
[unia_mecze typ="oba" limit="5"]
```

**Parametry:**
- `typ` → `rozegrane` | `planowane` | `oba`
- `limit` → liczba meczów (domyślnie 5)

## Aktualizacja automatyczna

GitHub Actions odpala scraper automatycznie co 6 godzin (00:00, 06:00, 12:00, 18:00 UTC).
Możesz też uruchomić ręcznie przez Actions → Run workflow.
