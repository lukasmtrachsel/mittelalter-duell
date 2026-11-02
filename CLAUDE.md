# Projekt: Mittelalter-Duell (Arbeitstitel)

Ein realistisches 1-gegen-1-Kampfspiel mit mittelalterlichen Waffen und Rüstungen, das im Browser läuft. Zwei Spieler spielen jeweils an ihrem eigenen Laptop mit Tastatur gegeneinander, verbunden per Peer-to-Peer über das Internet. Das Spiel ist privat für zwei Freunde gedacht, nicht für die Veröffentlichung.

Diese Datei ist die Grundlage für die Entwicklung. Halte dich an die Mechaniken, die Technik und die Reihenfolge der Etappen. Wenn etwas unklar ist oder eine Entscheidung offen ist, frag nach, statt zu raten.

---

## 1. Leitlinien

- **Realismus vor Arcade.** Kein Lebensbalken-Gekloppe. Trefferzonen, Rüstungslücken, Schadensarten, Ausdauer und Gewicht entscheiden. Fairness entsteht dadurch, dass jede Ausrüstung eine historische Antwort hat, nicht durch künstliches Abschwächen.
- **Kein Spielelement ohne historischen Bezug.** Werte orientieren sich an echten Waffen und Rüstungen (Richtwerte in Abschnitt 5).
- **Kampfgefühl ist das Wichtigste.** Treffer müssen wuchtig, Blocks und Paraden lesbar und fair sein.
- **Immer spielbar bleiben.** Nach jeder Etappe muss das Spiel startbar und testbar sein.
- **Daten getrennt vom Code.** Alle Waffen-, Rüstungs- und Balancing-Werte liegen in JSON-Dateien, damit sie ohne Codeänderung angepasst werden können.

---

## 2. Technik

| Bereich | Wahl |
|---|---|
| Sprache | TypeScript |
| Build/Dev-Server | Vite |
| 3D-Grafik | Three.js |
| Physik & Kollision | Rapier (`@dimforge/rapier3d-compat`) |
| Netzwerk | PeerJS (WebRTC, öffentlicher PeerJS-Vermittlungsserver, kein eigener Server) |
| Figuren & Grundanimationen | Mixamo (FBX → in glTF/GLB umwandeln) |
| Rüstung, Waffen, Umgebung | Low-Poly-Assets (z. B. Quaternius, CC0) oder eigene Modelle aus Blender, Format GLB |
| Speicherung Profil | `localStorage` im Browser, mit Export/Import als JSON |

Lizenzen aller Assets in `assets/LICENSES.md` festhalten.

### Netzwerk-Architektur

- **Raumcode-System:** Spieler A klickt „Raum erstellen“ und erhält einen kurzen Code (Peer-ID). Spieler B gibt den Code ein und verbindet sich.
- **Host ist Schiedsrichter (host-authoritative):** Der Laptop, der den Raum erstellt, berechnet Physik, Treffer und Schaden verbindlich. Der andere schickt nur seine Eingaben.
- **Eingaben senden** mit 30–60 Hz, der Host schickt den Spielzustand zurück.
- **Client-Vorhersage** für die eigene Bewegung, **Interpolation** für die Bewegung des Gegners, damit es trotz Verzögerung flüssig wirkt.
- **Ping-Anzeige** im Spiel.
- **Fehlerfall:** Wenn die Verbindung nicht zustande kommt, klare Meldung anzeigen (mögliche Ursache: strenges Netzwerk wie Schul- oder Firmen-WLAN).
- **TURN-Server nur als Fallback:** Standard ist die direkte Verbindung (STUN). TURN-Server (z. B. kostenloser Metered-Account) dürfen eingetragen werden (`data/network.json`), werden aber nur genutzt, wenn die direkte Verbindung scheitert. Ohne Eintrag läuft alles rein über STUN.
- **Fairness / Latenz:** Der Host hat 0 ms Ping. Zum Ausgleich zuerst **großzügiges Parade-Fenster (ca. 200 ms)**. Lag-Kompensation (Zurückspulen beim Host) erst später, falls Tests zeigen, dass es nötig ist.

### Hosting

- **GitHub Pages.** Das Spiel wird per GitHub Actions gebaut (`npm run build`) und als statische Seite veröffentlicht. Beide Spieler öffnen nur die URL, kein Node.js nötig.
- Vite `base` ist relativ (`./`), damit der Build unter `https://<name>.github.io/<repo>/` läuft.
- Versionsverwaltung mit **Git** von Anfang an; nach jeder Etappe ein Commit.

---

## 3. Spielmodi

1. **1-gegen-1-Duell** (jetzt): Beide wählen Ausrüstung, dann Kampf in einer Arena. Sieg durch kampfunfähig machen des Gegners. Best-of-3 als Standard.
2. **Turnierreiten / Tjost** (später, NICHT jetzt bauen): Die Architektur soll aber ein Modus-System haben, damit der Tjost später als eigener Modus ergänzt werden kann (eigene Szene, eigene Regeln, gemeinsame Profile und Netzwerkschicht).

---

## 4. Kampfsystem

### 4.1 Steuerung (nur Tastatur)

Jeder Spieler hat die ganze Tastatur. Die Kamera richtet sich automatisch auf den Gegner aus (Lock-on), die Maus/das Touchpad wird nicht gebraucht.

Linke Hand: Bewegung. Rechte Hand: Richtung + Angriff/Block gleichzeitig, ohne Umgreifen.

| Taste | Aktion |
|---|---|
| W A S D | Bewegen (relativ zum Gegner: vor, zurück, seitlich umkreisen) |
| I / J / K / L | Angriffsrichtung / Zielzone wählen (oben / links / unten / rechts) |
| U | Hieb (Schnitt bzw. Schlag) in gewählter Richtung |
| O | Stich in gewählte Richtung |
| H | Block / Parade (Richtung über I/J/K/L) |
| Leertaste | Ausweichen (Schritt in Bewegungsrichtung) |
| Shift | Sprinten (kostet Ausdauer) |
| Q | Griffwechsel: normal → Halbschwert → Mordschlag (nur bei passenden Waffen) |
| E | Ringen / Stoß mit Schild oder Körper |
| Esc | Menü |
| F1 | Debug-Modus |

- Tasten werden über **`KeyboardEvent.code`** abgefragt (physische Position), nicht über `key`. So liegt die Belegung auf jedem Layout gleich (der Spieler nutzt eine **Schweizer QWERTZ-Tastatur**: kein eigenes „;“, Y/Z vertauscht – deshalb keine Standardbelegung auf Y, Z oder Sonderzeichen).
- Tastenbelegung liegt in `data/controls.json` und soll im Menü änderbar sein (Etappe 6). In der Anzeige wird, wo der Browser es kann, die echte Beschriftung des Layouts gezeigt.

### 4.2 Trefferzonen statt Lebensbalken

Der Körper ist in Zonen aufgeteilt, jeweils als Kollisionskapsel an den Knochen der Figur:

Kopf, Gesicht, Hals, Oberkörper, Bauch, Achseln (links/rechts), Oberarme, Unterarme, Hände, Oberschenkel, Knie/Kniekehlen, Unterschenkel.

Jede Zone hat eigene Verletzungsfolgen:

| Zone | Folge bei schwerem Treffer |
|---|---|
| Kopf / Gesicht / Hals | Kampfunfähig oder tödlich |
| Oberkörper / Bauch | Starker Blutverlust, Ausdauer sinkt schneller |
| Achseln | Sehr gefährlich (große Gefäße), Arm geschwächt |
| Arme / Hände | Waffe langsamer oder fallen gelassen |
| Beine / Knie | Langsamer, Ausweichen eingeschränkt, Sturz möglich |

Zusätzlich gibt es einen **Blutverlust-Wert**, der mit der Zeit steigt. Erreicht er einen Grenzwert, ist der Spieler kampfunfähig.

### 4.2a HUD (Anzeige)

- **Eigener Zustand:** Ausdauer, Blutverlust und eine Körperkarte mit den eigenen Verletzungen.
- **Gegner:** keine Zahlen oder Balken. Nur sichtbare Zeichen an der Figur: Humpeln, Blut, langsamere Bewegungen, hängender Arm usw.
- Kein Lebensbalken.

### 4.3 Treffererkennung

- Die Klinge/der Waffenkopf ist eine Kollisionsform, deren Bewegung **zwischen zwei Frames durchgefegt** wird (Sweep), damit schnelle Schläge nicht durch den Gegner „hindurchtunneln“.
- Pro Treffer werden berechnet: getroffene Zone, Auftreffgeschwindigkeit, Winkel, Schadensart, welcher Waffenteil getroffen hat (Schneide, Spitze, Flachseite, Knauf).
- **Wucht/Energie** ≈ ½ · Masse · Geschwindigkeit². Ein voll ausgeführter Schlag hat deutlich mehr Wirkung als ein Streifschuss.
- Treffer mit der Flachseite oder sehr schräg: kaum Wirkung.

### 4.4 Schadensarten und Rüstung

Drei Schadensarten: **Schnitt**, **Stich**, **Wucht**.

Wirkung pro Rüstungsmaterial **pro Schicht** (Richtwerte, 1.0 = voller Schaden, im Balancing anpassbar):

| Material (eine Schicht) | Schnitt | Stich | Wucht |
|---|---|---|---|
| Ungeschützt | 1.0 | 1.0 | 1.0 |
| Gambeson | 0.5 | 0.7 | 0.8 |
| Kettenhemd (allein) | 0.2 | 0.7 | 0.75 |
| Brigantine / Plattenrock | 0.05 | 0.3 | 0.5 |
| Plattenrüstung | 0.0 | 0.1 | 0.4 |

- **Schichten werden multipliziert.** Beispiel Kettenhemd über Gambeson: Schnitt 0.5 × 0.2 = 0.1, Stich 0.7 × 0.7 ≈ 0.5, Wucht 0.8 × 0.75 = 0.6 (entspricht dem ursprünglichen Richtwert „Kettenhemd über Gambeson“).
- **Schichtmodell:** Jeder Körperslot hat drei Unterslots: **Unterschicht** (z. B. Gambeson), **Mittelschicht** (z. B. Kettenhemd, Kettenhaube, Kettenbeinlinge), **Oberschicht** (z. B. Brigantine, Plattenharnisch, Helm, Beinzeug). Jedes Teil gibt in `data/armor.json` an, in welchem Slot und welcher Schicht es liegt.
- Stiche auf Platte gleiten meist ab, außer bei sehr hoher Energie und günstigem Winkel.
- **Rüstungslücken:** Jedes Rüstungsteil deckt bestimmte Zonen ab, aber nicht lückenlos. Achseln, Kniekehlen, Visierschlitz, Handinnenflächen, Ellenbeuge, Gesäß und Hals sind je nach Teil offen oder nur durch Kette/Gambeson geschützt. Ein Treffer in eine Lücke ignoriert die Schicht mit der Lücke (z. B. die Platte), darunterliegende Schichten wirken weiter.
- **Lücken-Wahrscheinlichkeit pro Zone:** Lücken sind keine eigenen Trefferzonen. Jedes Rüstungsteil hat pro abgedeckter Zone eine Lücken-Wahrscheinlichkeit (z. B. Plattenharnisch: Achsel 0.6). Bei einem Treffer in diese Zone wird gewürfelt, ob die Lücke getroffen wurde. **Gezielte Stiche** (Stich mit passender Richtung, besonders im Halbschwert und mit dem Dolch) erhöhen die Wahrscheinlichkeit über einen Faktor aus `data/balance.json`. Hiebe haben eine geringere Lücken-Chance als Stiche.
- Wucht wird durch Rüstung gedämpft, aber nie ganz aufgehoben (Gehirnerschütterung, Prellungen, Brüche).

### 4.5 Historische Techniken

- **Halbschwert:** Schwert mit der zweiten Hand an der Klinge gegriffen. Kürzere Reichweite, aber sehr präzise und kraftvolle Stiche, ideal gegen Rüstungslücken.
- **Mordschlag:** Schwert an der Klinge gehalten, Schlag mit Knauf und Parierstange wie mit einem Hammer. Wucht-Schaden, gut gegen Helme.
- **Parade:** Block im richtigen Moment lenkt die gegnerische Waffe ab und öffnet ein kurzes Zeitfenster für einen Gegenangriff. Zu frühes oder spätes Blocken = normaler Block mit Ausdauerkosten. Parade-Fenster zunächst **ca. 200 ms** (in `data/balance.json`), wegen der Netzwerk-Latenz bewusst großzügig.
- **Ringen:** Auf kurzer Distanz Gegner stoßen, aus dem Gleichgewicht bringen oder zu Boden werfen.
- **Bindung** (optional, spätere Etappe): Klingen bleiben in Kontakt, Druck und Hebel entscheiden.

### 4.6 Ausdauer und Gewicht

- Jede Aktion kostet Ausdauer: Angriff je nach Waffengewicht, Block je nach Wucht des Gegners, Sprint und Ausweichen pauschal.
- Ausdauer regeneriert, schneller wenn man stillsteht.
- Bei leerer Ausdauer: langsamere Angriffe, schwache Blocks, kein Ausweichen.
- **Gesamtgewicht** der Ausrüstung beeinflusst Ausdauerverbrauch, Regeneration und Beschleunigung. Wichtig: Gut sitzende Plattenrüstung behindert die Beweglichkeit historisch deutlich weniger, als oft angenommen. Der Haupteffekt ist schnellere Ermüdung, nicht Unbeweglichkeit.
- **Helme** schränken je nach Typ die Sicht ein (Sichtfeld der Kamera / Vignette).

---

## 5. Ausrüstung und historische Richtwerte

Die folgenden Werte sind Richtwerte aus historischen Funden und Rekonstruktionen. Vor der finalen Verwendung einzeln gegenprüfen und Quellen in `data/QUELLEN.md` notieren.

### 5.1 Waffen (Start: diese 8)

| Waffe | Gewicht | Länge | Hände | Schadensarten | Stärken | Schwächen |
|---|---|---|---|---|---|---|
| Dolch (Rondelldolch) | 0,3–0,5 kg | 30–50 cm | 1 | Stich | Sehr schnell, ideal gegen Rüstungslücken im Ringen | Kaum Reichweite |
| Einhandschwert | 0,9–1,4 kg | 75–95 cm | 1 | Schnitt, Stich | Vielseitig, mit Schild kombinierbar | Wenig gegen Platte |
| Langschwert | 1,2–1,8 kg | 110–130 cm | 2 | Schnitt, Stich, Wucht (Mordschlag) | Sehr vielseitig, Halbschwert & Mordschlag | Kein Schild möglich |
| Falchion | 0,9–1,4 kg | 70–90 cm | 1 | Schnitt | Starke Hiebe | Schwacher Stich |
| Streitkolben (Schlagblätter) | 1,0–2,0 kg | 50–70 cm | 1 | Wucht | Gut gegen Platte | Kurze Reichweite, langsam |
| Streitaxt (zweihändig) | 1,5–2,5 kg | 100–150 cm | 2 | Schnitt, Wucht | Kräftige Hiebe, Haken | Langsamer Rückzug, kein Schild |
| Speer | 1,5–2,5 kg | 200–250 cm | 1–2 | Stich | Größte Reichweite | Schwach auf kurzer Distanz |
| Mordaxt / Streithammer (Stangenwaffe) | 2,0–3,0 kg | 150–200 cm | 2 | Wucht, Stich, Schnitt | Beste Waffe gegen Platte | Langsam, hoher Ausdauerverbrauch |

Später erweiterbar: Zweihänder, Hellebarde, Reiterhammer, Kriegsflegel, Säbel/Messer.

### 5.2 Schilde

| Schild | Gewicht | Stärken | Schwächen |
|---|---|---|---|
| Buckler (Faustschild) | 0,5–1,5 kg | Leicht, schnelle Paraden | Kleine Deckung |
| Dreiecksschild (Heizerschild) | 2–4 kg | Gute Deckung | Schwerer, langsamer |
| Rundschild | 3–6 kg | Große Deckung | Schwer, ermüdet |

### 5.3 Rüstungsteile

Slots: **Kopf, Oberkörper, Arme, Hände, Beine** (+ Schild in der Nebenhand). Jeder Slot hat die Unterslots **Unter-, Mittel- und Oberschicht** (siehe 4.4); Teile werden geschichtet (z. B. Gambeson unter Kettenhemd unter Plattenharnisch).

| Slot | Schicht | Teil | Gewicht | Deckt ab | Lücken |
|---|---|---|---|---|---|
| Kopf | Mittel | Kettenhaube | 1–2 kg | Kopf, Hals | Gesicht offen |
| Kopf | Ober | Beckenhaube mit Visier | 2–3,5 kg | Kopf, Gesicht | Visierschlitz, Hals ohne Kragen |
| Kopf | Ober | Topfhelm | 2–3,5 kg | Kopf, Gesicht | Sehr eingeschränkte Sicht |
| Oberkörper | Unter | Gambeson | 2–6 kg | Oberkörper, Arme | Keine Lücken, aber geringer Schutz |
| Oberkörper | Mittel | Kettenhemd | 8–15 kg | Oberkörper, Oberarme | Schutz nur zusammen mit Gambeson gegen Wucht |
| Oberkörper | Ober | Brigantine | 8–12 kg | Oberkörper | Achseln |
| Oberkörper | Ober | Plattenharnisch (Brust/Rücken) | 10–15 kg | Oberkörper, Bauch | Achseln, Hals |
| Arme | Ober | Armzeug (Platte) | 3–5 kg | Ober- und Unterarme | Ellenbeuge, Achseln |
| Hände | Ober | Lederhandschuhe | 0,2–0,5 kg | Hände | Kaum Schutz |
| Hände | Ober | Plattenhandschuhe | 0,8–1,5 kg | Hände | Handinnenfläche |
| Beine | Mittel | Kettenbeinlinge | 3–6 kg | Beine | Wenig gegen Wucht |
| Beine | Ober | Beinzeug (Platte) | 5–8 kg | Beine, Knie | Kniekehlen, Gesäß |

Die Lücken werden als Lücken-Wahrscheinlichkeit pro Zone in `data/armor.json` hinterlegt (siehe 4.4).

Vollständige Plattenrüstung des 15. Jahrhunderts wog insgesamt etwa 20–30 kg, verteilt über den ganzen Körper.

### 5.4 Datenformat

Jede Waffe und jedes Rüstungsteil ist ein Eintrag in `data/weapons.json` bzw. `data/armor.json`, z. B.:

```json
{
  "id": "longsword",
  "name": "Langschwert",
  "massKg": 1.5,
  "lengthCm": 120,
  "hands": 2,
  "balancePoint": 0.12,
  "damageTypes": ["cut", "thrust", "blunt"],
  "grips": ["normal", "halfsword", "mordschlag"],
  "staminaCost": { "cut": 12, "thrust": 9, "blunt": 15 },
  "model": "assets/weapons/longsword.glb"
}
```

---

## 6. Figuren und Grafik

- **Realistischere Menschenfiguren**, keine Stickmen. Basis: geriggte Figur von Mixamo.
- **Animationen:** Grundbewegungen (Stehen, Gehen, Seitwärts, Ausweichen, Treffer, Sturz) von Mixamo. Angriffe und Blocks werden aus Mixamo-Animationen kombiniert und per Code nachjustiert, damit die Waffe die gewählte Richtung trifft (Inverse Kinematik für die Arme).
- **Rüstung und Waffen** sind einzelne GLB-Modelle, die an die passenden Knochen gehängt werden (Kopf, Brust, Oberarm, Unterarm, Hand, Oberschenkel, Unterschenkel). So entsteht die frei kombinierbare Ausrüstung.
- **Treffer-Feedback:** kurzer Ruck/Stillstand beim Treffer (Hit-Stop), Funken bei Metall, Ton je nach Material, Schadensdarstellung an der Figur.
- **Arena:** zunächst eine einfache Turnierwiese mit Holzzaun, **groß genug für den Speer** (Innenfläche ca. 30 × 20 m, Maße in `data/balance.json`). Weitere Arenen später.
- **Platzhalter-Figuren:** In Etappe 1 einfache Platzhalter (Körper, Kopf, Blickrichtung erkennbar). Mixamo-Figuren werden später eingebaut; der Code trennt deshalb Figur-Darstellung und Spiellogik.
- **Leistung:** muss auf normalen Laptops flüssig laufen (Ziel 60 FPS). Low-Poly-Stil ist ausdrücklich in Ordnung.

---

## 7. Profil und Punkte

- Beim ersten Start legt jeder Spieler ein **Profil** an: Name, Farbe/Wappen.
- Gespeichert werden: Siege, Niederlagen, **Punkte**, Lieblingswaffe, Kampfhistorie (Datum, Gegner, Ausrüstung, Ergebnis), gespeicherte Ausrüstungs-Sets.
- **Punkte:** +10 für einen gewonnenen 1-gegen-1-Kampf (Wert in Konfiguration anpassbar).
- Speicherung in `localStorage`. Da dieser verloren gehen kann: **Export/Import** des Profils als JSON-Datei im Menü.
- Nach jedem Kampf schickt der Host das Ergebnis an beide, beide Profile werden aktualisiert.

---

## 8. Menüs und Ablauf

1. Startbildschirm → Profil wählen/anlegen
2. Hauptmenü: Raum erstellen / Raum beitreten / Ausrüstung / Profil / Einstellungen
3. **Ausrüstungsbildschirm:** Figur in 3D drehbar, Slots anklicken, Teile wählen. Anzeige von Gesamtgewicht, Schutz pro Zone (farbige Körperkarte mit Lücken) und Auswirkungen auf Ausdauer
4. Lobby: beide Spieler sehen sich, wählen Ausrüstung, bestätigen „bereit“
5. Kampf (Best-of-3)
6. Ergebnisbildschirm mit Statistik (Treffer pro Zone, entscheidender Treffer), Punkte-Update

---

## 9. Ordnerstruktur (Vorschlag)

```
/src
  /core        Spielschleife, Szenen, Modus-System
  /net         PeerJS, Synchronisation, Vorhersage
  /combat      Trefferzonen, Schaden, Ausdauer, Techniken
  /character   Figur, Animation, IK, Ausrüstung anhängen
  /ui          Menüs, HUD, Ausrüstungsbildschirm
  /profile     Profil, Speicherung, Export/Import
  /modes
    /duel      1-gegen-1
    /joust     (später)
/data          weapons.json, armor.json, balance.json, controls.json, network.json, QUELLEN.md
/assets        models, animations, sounds, LICENSES.md
```

---

## 10. Etappen

Jede Etappe endet mit einem spielbaren Stand. Erst zur nächsten Etappe, wenn die Abnahmekriterien erfüllt sind.

**Etappe 1 – Grundgerüst & Verbindung**
- Vite + TypeScript + Three.js + Rapier aufsetzen
- Arena, zwei Figuren (Platzhalter, Mixamo später), Bewegung mit WASD, Lock-on-Kamera
- PeerJS-Raumcode, Host-Schiedsrichter, Synchronisation der Bewegung
- Git, GitHub-Pages-Deployment, Lokaltest-Modus, Debug-Anzeige (F1)
- *Abnahme:* Zwei Laptops über das Internet verbunden, beide Figuren bewegen sich flüssig auf beiden Bildschirmen.

**Etappe 2 – Kampfkern**
- Langschwert, Hieb/Stich/Block in vier Richtungen, Parade
- Trefferzonen, Sweep-Treffererkennung, Schadensarten, Blutverlust, Ausdauer
- Runden und Sieg
- *Abnahme:* Ein vollständiges Duell mit Langschwert ist spielbar und fühlt sich fair an.

**Etappe 3 – Rüstung**
- Rüstungsslots, Schichten, Lücken, Material-Tabelle, Gewichtseffekte
- Ausrüstungsbildschirm mit Körperkarte
- *Abnahme:* Ungerüstet gegen Vollplatte fühlt sich deutlich anders an, und Stiche in Lücken funktionieren.

**Etappe 4 – Waffenvielfalt & Techniken**
- Alle 8 Waffen + 3 Schilde aus Abschnitt 5
- Halbschwert, Mordschlag, Ringen
- *Abnahme:* Jede Waffe hat eine erkennbare Rolle, keine ist in allen Situationen die beste.

**Etappe 5 – Profil & Punkte**
- Profile, Punkte, Historie, Export/Import, Ergebnisbildschirm
- *Abnahme:* Punkte werden nach jedem Kampf bei beiden korrekt gespeichert.

**Etappe 6 – Feinschliff**
- Sounds, Treffer-Feedback, Menüs, Einstellungen, Tastenbelegung
- Balancing nach Testspielen

**Später:** Turnierreiten (Tjost) als eigener Modus, weitere Waffen und Arenen.

---

## 11. Arbeitsweise für Claude Code

- In kleinen Schritten arbeiten und nach jedem Schritt sicherstellen, dass das Spiel startet (`npm run dev`).
- Alle Zahlenwerte für Balancing in `data/*.json`, nie fest im Code.
- Einen **Debug-Modus** einbauen (Taste F1): zeigt Trefferzonen, Waffen-Kollision, Ausdauer, Ping und den Schaden jedes Treffers. Wichtig fürs Balancing.
- Einen **Lokaltest-Modus** einbauen: zwei Browserfenster auf demselben Rechner können sich verbinden, damit Netzwerk ohne zweiten Laptop getestet werden kann. Umgesetzt über `BroadcastChannel` (ohne Internet), Adresse `?lokal=1`; künstliche Latenz mit `?lag=80&jitter=20`.
- Testanleitungen liegen in `docs/TESTANLEITUNG-EtappeN.md`.
- Multiplayer-Verhalten wird letztlich von den beiden Spielern getestet. Nach jeder Etappe eine kurze Testanleitung schreiben: was testen, worauf achten.
- Bei Abweichungen von dieser Datei (z. B. andere Bibliothek) erst nachfragen.
- Diese Datei aktuell halten, wenn sich Entscheidungen ändern.
