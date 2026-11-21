# FESTIVAL'S LIFE — Krok 2: Fundament GitHub + Supabase

## 1. Utwórz bazę w Supabase (2 minuty)
1. Załóż nowy projekt w Supabase (region **Frankfurt / EU Central**).
2. Wejdź w **SQL Editor → New Query**, wklej zawartość `supabase/schema.sql` i kliknij **Run**.
3. Utwórz swoje konto w **Authentication → Users → Add user** (email + hasło) i skopiuj jego **User UID**.

## 2. Przenieś swoje 156 koncertów jednym skryptem
1. Skopiuj `.env.example` jako `.env` i wklej `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (z *Project Settings → API*) oraz `TARGET_USER_ID` (Twój User UID).
2. Uruchom w terminalu (bez żadnego `pip install`):
   ```bash
   python scripts/migrate_to_supabase.py --data-dir ./festivals_life_local
   ```

## 3. Wypchnij repozytorium na GitHub
```bash
git init
git add .
git commit -m "Initial commit: FESTIVAL'S LIFE + Supabase schema"
git branch -M main
git remote add origin https://github.com/TWOJ-LOGIN/festivals-life.git
git push -u origin main
```
Plik `.env` jest dodany do `.gitignore`, więc Twoje tajne klucze nigdy nie trafią na GitHuba.
