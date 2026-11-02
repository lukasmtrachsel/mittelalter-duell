// Nachrichten zwischen Host (Schiedsrichter) und Client im Duell-Modus.

/** Bewegungseingabe für einen Simulationsschritt. */
export interface MoveInput {
  /** Laufende Nummer (für Abgleich der Client-Vorhersage). */
  seq: number;
  /** Vor (+1) / zurück (−1) relativ zum Gegner. */
  f: number;
  /** Rechts (+1) / links (−1) relativ zum Gegner. */
  s: number;
  sprint: boolean;
  /** Blickrichtung zum Gegner aus Sicht des Senders (Einheitsvektor in x/z). */
  fx: number;
  fz: number;
}

/** Zustand einer Figur: Position und Geschwindigkeit in x/z. */
export type BodyState = [x: number, z: number, vx: number, vz: number];

export type DuelMessage =
  | { k: 'input'; i: MoveInput }
  /** Spielzustand vom Host. p[0] = Host-Figur, p[1] = Client-Figur. ack = letzte verarbeitete Client-Eingabe. */
  | { k: 'state'; tick: number; ht: number; p: [BodyState, BodyState]; ack: number };

export function isDuelMessage(m: unknown): m is DuelMessage {
  return typeof m === 'object' && m !== null && 'k' in m;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
