# FEST LIFE v12 — Native-Ready React + Capacitor

Nowoczesna architektura **Vite + React + TypeScript + Tailwind + Capacitor**, łącząca:
- **Konva.js (`react-konva`)** — dotykowy edytor Wrapped Studio 9:16 (przesuwanie, skalowanie, obracanie kafelków + zdjęcia/wideo w tle)
- **Vaul** — natywne dolne panele (Bottom Sheets) ze sprężystą fizyką i zamykaniem gestem w dół
- **Motion** — płynne przejścia zakładek (`layoutId`), animowane liczniki i mikro-interakcje
- **Radix UI + Anty-AI Editorial Design** — minimalistyczny, wysokokontrastowy interfejs bez zbędnych ramek i poświat
- **Tabler Icons** — spójna grubość linii (`stroke={1.75}`) w całej aplikacji
- **cmdk** — błyskawiczna wyszukiwarka Spotlight (`Ctrl+K` / `⌘K`)
- **Sonner** — powiadomienia toast z obsługą gestów
- **Recharts** — minimalistyczne wykresy analityczne
- **Lottie-web** — oszczędne mikro-animacje (korektor 30s odsłuchu, puls statusu)
- **Capacitor 6** — gotowa konfiguracja pod natywną aplikację **iOS** i **Android** (z natywną haptyką)

## 1. Uruchomienie lokalne (Windows PowerShell / macOS)
```powershell
npm install
copy .env.example .env
# Wpisz swój klucz sb_publishable_... do pliku .env w polu VITE_SUPABASE_ANON_KEY
npm run dev
```

## 2. Automatyczny deploy na GitHub Pages
1. W repozytorium GitHub wejdź w **Settings → Secrets and variables → Actions → New repository secret**.
2. Dodaj sekret:
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: Twój klucz `sb_publishable_...`
3. W **Settings → Pages → Source** wybierz **GitHub Actions**.
4. Wypchnij kod (`git add .`, `git commit -m "v12: React + Konva + Vaul + Capacitor"`, `git push`).

## 3. Budowanie natywnej aplikacji Android & iOS (Capacitor)
```powershell
# Dodanie platform (jednorazowo):
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# Zbudowanie i otwarcie w Android Studio / Xcode:
npm run cap:android
npm run cap:ios
```
