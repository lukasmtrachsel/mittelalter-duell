// Tastatureingabe über KeyboardEvent.code (physische Taste, unabhängig vom Layout).
import { controls, type Action } from './config';

const codeToActions = new Map<string, Action[]>();
for (const [action, codes] of Object.entries(controls) as [Action, string[]][]) {
  for (const code of codes) {
    const list = codeToActions.get(code) ?? [];
    list.push(action);
    codeToActions.set(code, list);
  }
}

type PressListener = (action: Action) => void;

class Keyboard {
  private down = new Set<Action>();
  private listeners = new Set<PressListener>();
  /** Wenn false, werden Spielaktionen ignoriert (z. B. während ein Textfeld aktiv ist). */
  enabled = true;
  private layoutMap: Map<string, string> | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.down.clear());
    // Echte Tastenbeschriftung des Layouts (z. B. Schweizer QWERTZ), sofern der Browser es kann.
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard;
    kb?.getLayoutMap().then((m) => (this.layoutMap = m)).catch(() => {});
  }

  private onKey(e: KeyboardEvent, pressed: boolean): void {
    const target = e.target as HTMLElement | null;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    const actions = codeToActions.get(e.code);
    if (!actions) return;
    if (typing && e.code !== 'F1') return;
    // Browser-Standardverhalten (Scrollen mit Leertaste, Hilfe mit F1) verhindern.
    e.preventDefault();
    for (const action of actions) {
      if (pressed) {
        const wasDown = this.down.has(action);
        this.down.add(action);
        if (!wasDown && !e.repeat) this.listeners.forEach((l) => l(action));
      } else {
        this.down.delete(action);
      }
    }
  }

  isDown(action: Action): boolean {
    return this.enabled && this.down.has(action);
  }

  onPress(listener: PressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Anzeigename einer Aktion, z. B. "W" oder "Leertaste". */
  label(action: Action): string {
    return [...new Set(controls[action].map((code) => this.codeLabel(code)))].join('/');
  }

  private codeLabel(code: string): string {
    const special: Record<string, string> = {
      Space: 'Leertaste', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc',
    };
    if (special[code]) return special[code];
    const fromLayout = this.layoutMap?.get(code);
    if (fromLayout) return fromLayout.toUpperCase();
    return code.replace(/^Key|^Digit/, '');
  }
}

export const keyboard = new Keyboard();
