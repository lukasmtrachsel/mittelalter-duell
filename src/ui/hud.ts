// Anzeige im Kampf. Etappe 1: Ping, Steuerungshinweis, Debug-Text.
// Ab Etappe 2: eigene Ausdauer, Blutverlust, Körperkarte (vom Gegner keine Zahlen).
import { keyboard } from '../core/input';

export class DuelHud {
  private root = document.createElement('div');
  private pingEl = document.createElement('div');
  private debugEl = document.createElement('pre');
  private warnEl = document.createElement('div');

  constructor() {
    this.root.className = 'hud';
    this.pingEl.className = 'hud-ping';
    this.debugEl.className = 'hud-debug';
    const hint = document.createElement('div');
    hint.className = 'hud-hint';
    const L = (a: Parameters<typeof keyboard.label>[0]) => keyboard.label(a);
    hint.textContent =
      `${L('moveForward')}${L('moveLeft')}${L('moveBack')}${L('moveRight')} bewegen · ` +
      `${L('sprint')} sprinten · ${L('menu')} Menü · ${L('debug')} Debug`;
    this.warnEl.className = 'hud-warn';
    this.warnEl.hidden = true;
    this.root.append(this.pingEl, this.debugEl, this.warnEl, hint);
    document.body.append(this.root);
  }

  update(s: { ping: number; warning: string | null; debug: string | null }): void {
    this.warnEl.hidden = s.warning === null;
    if (s.warning !== null) this.warnEl.textContent = s.warning;
    const p = Math.round(s.ping);
    this.pingEl.textContent = `Ping ${p} ms`;
    this.pingEl.dataset.q = p < 80 ? 'good' : p < 150 ? 'ok' : 'bad';
    this.debugEl.hidden = s.debug === null;
    if (s.debug !== null) this.debugEl.textContent = s.debug;
  }

  dispose(): void {
    this.root.remove();
  }
}
