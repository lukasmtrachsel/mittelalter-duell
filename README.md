# Mittelalter-Duell

Privates 1-gegen-1-Kampfspiel im Browser (Three.js, Rapier, PeerJS). Die Planung steht in [CLAUDE.md](CLAUDE.md).

## Lokal starten

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen. Für den Lokaltest mit zwei Fenstern: `http://localhost:5173/?lokal=1`.
Die Testanleitung liegt unter [docs/TESTANLEITUNG-Etappe1.md](docs/TESTANLEITUNG-Etappe1.md).

## Auf GitHub Pages veröffentlichen (einmalig einrichten)

1. Auf GitHub ein neues Repository anlegen (darf privat sein, wenn euer Konto Pages für private Repos erlaubt, sonst öffentlich).
2. Lokal verknüpfen und hochladen:
   ```bash
   git remote add origin https://github.com/<name>/<repo>.git
   git push -u origin main
   ```
3. Auf GitHub: **Settings → Pages → Source: „GitHub Actions“** wählen.
4. Bei jedem Push auf `main` baut der Workflow `.github/workflows/deploy.yml` das Spiel und veröffentlicht es unter
   `https://<name>.github.io/<repo>/`.

## TURN-Server (optional)

Falls ein Netz (z. B. Schul-WLAN) direkte Verbindungen blockiert, im Hauptmenü unter **„Netzwerk (TURN-Server)“** die Liste eines TURN-Anbieters einfügen (z. B. von einem kostenlosen Metered-Konto) und speichern. Sie wird nur im eigenen Browser gespeichert, nicht im Repository.

Format (so zeigt es z. B. Metered an):

```json
[
  { "urls": "turn:<server>:80", "username": "<user>", "credential": "<passwort>" },
  { "urls": "turns:<server>:443?transport=tcp", "username": "<user>", "credential": "<passwort>" }
]
```

Die Verbindung bevorzugt trotzdem immer den direkten Weg; TURN wird nur genutzt, wenn der nicht möglich ist.
Alternativ können feste Einträge in `data/network.json` unter `turnServers` stehen – bei einem öffentlichen Repository sind sie dann aber für alle sichtbar.

## Daten

Alle Balancing-Werte liegen in `data/*.json` (Bewegung, Kamera, Arena, Tastenbelegung, Netzwerk).
