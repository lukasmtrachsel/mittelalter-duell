# Testanleitung – Etappe 1: Grundgerüst & Verbindung

**Abnahmekriterium:** Zwei Laptops sind über das Internet verbunden, und beide Figuren bewegen sich auf beiden Bildschirmen flüssig.

## A. Lokaltest (ein Rechner, kein Internet nötig)

1. `npm run dev` starten und `http://localhost:5173/?lokal=1` in **zwei Fenstern** öffnen (nebeneinander, beide sichtbar).
2. Fenster 1: **Raum erstellen**. Der Code erscheint.
3. Fenster 2: Code eingeben (Groß-/Kleinschreibung egal) → **Raum beitreten**. Bei beiden muss „Lokaltest“ angehakt sein.
4. Abwechselnd in beide Fenster klicken und laufen.

**Mit künstlicher Verzögerung:** `http://localhost:5173/?lokal=1&lag=80&jitter=20` (+80 ms je Richtung, also ca. 160 ms Ping). So testet ihr die Vorhersage, ohne zweiten Laptop.

> Hinweis: Ein minimiertes Fenster oder ein Tab im Hintergrund pausiert das Spiel (der Browser hält es an). Beim Lokaltest beide Fenster sichtbar nebeneinander stellen.

## B. Internet-Test (zwei Laptops)

1. Beide öffnen die GitHub-Pages-URL (Einrichtung siehe README).
2. Spieler A: **Raum erstellen**, Code per Chat/Telefon weitergeben.
3. Spieler B: Code eingeben → **Raum beitreten** („Lokaltest“ **nicht** anhaken).
4. Mit **F1** die Debug-Anzeige öffnen. Unter „Verbindung“ steht, ob die Verbindung *direkt (P2P)* oder über ein *TURN-Relay* läuft.

## Worauf achten

| Prüfen | Erwartung |
|---|---|
| Bewegung W/A/S/D | W läuft auf den Gegner zu, S weg, A/D umkreisen ihn. Rückwärts ist langsamer. |
| Shift | Sprinten nur vorwärts, deutlich schneller. |
| Kamera | Bleibt hinter der eigenen Figur und hat den Gegner immer im Blick, auch beim Umkreisen. |
| Eigene Figur (Gast) | Reagiert **sofort** auf Tasten, auch bei hohem Ping. Kein Ruckeln, kein Zurückspringen. |
| Gegner-Figur | Läuft gleichmäßig, ohne Sprünge (leicht verzögert ist normal). |
| Zusammenstoß | Figuren laufen nicht durcheinander durch und nicht durch den Zaun. |
| Ping | Oben rechts, grün < 80 ms, gelb < 150 ms, rot darüber. |
| F1 Debug | Zeigt Rolle, Verbindungsweg, FPS, Ping, Positionen, Korrekturen und Kollisionsformen. „Letzte Korrektur“ sollte beim normalen Laufen nahe 0 cm liegen. |
| Esc | Menü öffnet sich, eigene Figur bleibt stehen. „Kampf verlassen“ → beide landen im Hauptmenü mit einer Meldung. |
| Fenster schließen | Der andere bekommt nach wenigen Sekunden „Mitspieler hat das Spiel verlassen“ bzw. „Verbindung verloren“. |
| Falscher Code | Klare Meldung „Raum nicht gefunden“. |
| Strenges Netz | Klare Meldung mit Hinweis auf Schul-/Firmen-WLAN, kein endloses Warten. |
| Leistung | FPS (F1) möglichst um 60 auf beiden Laptops. |

## Bitte zurückmelden

- Fühlt sich die Bewegung zu schnell oder zu langsam an? (Werte in `data/balance.json` → `movement`)
- Kamera zu nah, zu fern oder zu hoch? (`data/balance.json` → `camera`)
- Ping-Wert und Verbindungsweg (direkt/TURN) im Internet-Test
- Jedes Ruckeln oder Springen: Wer war Host, wer hat gesehen, was?
