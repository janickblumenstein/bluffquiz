# Bierkultur Mallorca 2026 – Companion App

Eine kollaborative Web-App für den Städtetrip: Bingo, Missionen, Städte-Voting, Quiz, Turniere.

## 📁 Projektstruktur

```
malle26/                    ← Repository-Root
├── index.html              ← Haupt-HTML (CSS + DOM-Gerüst)
├── README.md               ← Diese Datei
└── js/
    ├── core.js             ← Login, Landingpage, Leaderboard, Host-Handover, Notifications
    ├── cities.js           ← Städte-Voting (6 Modi + Editor mit Preis/Abflug)
    ├── missions.js         ← Missionen (einmalig / mehrmalig)
    ├── bingo.js            ← Bier-Bingo mit Peer-Bestätigung
    ├── solo.js             ← Solo-Spiele (Kopfrechnen / Schätzen / Reaktion)
    ├── official.js         ← Quiz-Multi + Duell mit mehreren Fragen
    └── tournament.js       ← Reaktions-Turnier + Schiffeversenken + TicTacToe-3
```

**Wichtig:** Die Ladereihenfolge in `index.html` ist festgelegt – `core.js` zuerst, dann die Submodule. Submodule hängen sich über `window.App.listeners` ein.

## 🚀 Deployment

### Option A: GitHub Pages (empfohlen)

1. Neues GitHub-Repo erstellen (z.B. `malle26`)
2. Alle Dateien hochladen – **genau mit dieser Ordnerstruktur**
3. Im Repo: **Settings → Pages → Source: `main` branch, folder: `/ (root)`**
4. Nach ein paar Sekunden läuft die App unter `https://<dein-username>.github.io/malle26/`
5. Diesen Link allen Teilnehmern schicken

### Option B: Lokal per Webserver

Weil die App ES-Modules nutzt, **kann sie nicht per `file://` geöffnet werden** – sie braucht einen HTTP-Server.

**Einfachste Variante mit Python:**
```
cd malle26
python3 -m http.server 8000
```
Dann im Browser `http://localhost:8000/` öffnen.

**Oder mit Node:**
```
npx serve malle26
```

### Option C: Netlify / Vercel

Ordner per Drag-and-Drop auf netlify.com drop – läuft sofort mit eigener URL.

## 🔑 Firebase-Setup

1. In `js/core.js` den `firebaseConfig` anpassen – vor allem `apiKey`.
2. In der Firebase Console unter **Realtime Database → Rules**:

```json
{
  "rules": {
    "rooms": {
      ".read": "now < 1749999999000",
      ".write": "now < 1749999999000"
    }
  }
}
```
(Unix-Timestamp in ms – setze ein Datum ~1 Woche nach dem Trip, dann wird die DB automatisch dicht.)

## 🎮 Features

**Rang-Tab:** Wochenend-Leaderboard, Punkte verschenken mit Notification an den Empfänger.

**Bingo:** 5×5 Karte mit regionalen Bieren, Bestätigung durch 2 andere Spieler, 10 Pkt pro Bingo.

**Spiele-Tab:** Solo-Spiele (Casual-Punkte) + offizielle Host-gestartete Runden.

**Städte-Tab:** 6 Voting-Modi, Editor für Preise/Abflugzeiten pro Stadt, automatische Flash-Animation.

**Missionen-Tab:** 12 Default-Missionen, jeder kann neue hinzufügen. Einmalig = erste Person bekommt Punkte, Mehrmalig = jeder einmal.

**Host-Tab:** Alle Host-Controls + versteckt auf Landingpage durch 3× Tap aufs BIERKULTUR-Logo.

## 🏆 Punkte-System

| Quelle | Punkte |
|---|---|
| Quiz-Multi Endabrechnung | 20 / 12 / 8 / 3 |
| Duell-Session Endabrechnung | 15 / 8 / 4 / 2 |
| Wer-Frage richtig getippt | +2 |
| Wer-Frage "Trostpreis" für Gewählten | +1 |
| Text-Frage Gewinner | +3 |
| Bingo | +10 |
| Turnier-Sieger | +5 oder +1 Bonus-Stadt-Stimme |
| Mission Einmalig | variabel (2–20) |
| Mission Mehrmalig | variabel pro Spieler |
| Solo-Spiele | Casual (×0.1 Gewichtung) |

## 🔧 Wartung während des Trips

- **Host übergeben:** Jeder klickt im Host-Tab "Host übernehmen", der aktuelle Host kriegt einen Bestätigungs-Dialog.
- **Scores auf 0:** Host-Panel → "Scores zurücksetzen" (behält Spieler, Städte, Missionen).
- **Komplett-Reset:** Host-Panel → "KOMPLETT-RESET" (Neustart vom Nullpunkt).
- **Stadt bearbeiten:** Als Host auf eine Stadt tippen → Editor mit Name/Preis/Abflug-Feldern öffnet sich.
