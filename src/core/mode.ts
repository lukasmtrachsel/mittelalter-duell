// Modus-System: Jeder Spielmodus (Duell, später Tjost) ist eine eigene Klasse
// mit eigener Szene und eigenen Regeln. Netzwerk und Renderer sind gemeinsam.
import type * as THREE from 'three';
import type { Transport } from '../net/transport';

export type Role = 'host' | 'client';

export interface ModeContext {
  renderer: THREE.WebGLRenderer;
  transport: Transport;
  role: Role;
  /** Wird aufgerufen, wenn der Modus beendet werden soll (z. B. Verbindung verloren). */
  exit(message?: string): void;
}

export interface GameMode {
  readonly id: string;
  /** Wird jeden Frame aufgerufen. dt in Sekunden. */
  frame(dt: number): void;
  resize(width: number, height: number): void;
  setDebug(on: boolean): void;
  dispose(): void;
}

export type ModeFactory = (ctx: ModeContext) => Promise<GameMode>;

const registry = new Map<string, ModeFactory>();

export function registerMode(id: string, factory: ModeFactory): void {
  registry.set(id, factory);
}

export function getMode(id: string): ModeFactory {
  const f = registry.get(id);
  if (!f) throw new Error(`Unbekannter Spielmodus: ${id}`);
  return f;
}
