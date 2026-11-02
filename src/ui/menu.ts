// Hauptmenü, Warte- und Verbindungsbildschirm.
import { controls, type Action } from '../core/config';
import { keyboard } from '../core/input';

export interface MenuHandlers {
  onHost(local: boolean): void;
  onJoin(code: string, local: boolean): void;
  onCancel(): void;
}

const ACTION_NAMES: [Action, string][] = [
  ['moveForward', 'Vor'], ['moveBack', 'Zurück'], ['moveLeft', 'Links umkreisen'], ['moveRight', 'Rechts umkreisen'],
  ['sprint', 'Sprinten'], ['dirUp', 'Richtung oben'], ['dirLeft', 'Richtung links'], ['dirDown', 'Richtung unten'],
  ['dirRight', 'Richtung rechts'], ['cut', 'Hieb'], ['thrust', 'Stich'], ['block', 'Block / Parade'],
  ['dodge', 'Ausweichen'], ['grip', 'Griffwechsel'], ['grapple', 'Ringen'], ['menu', 'Menü'], ['debug', 'Debug'],
];
const AVAILABLE_NOW = new Set<Action>(['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'sprint', 'menu', 'debug']);

export class MainMenu {
  private root = document.createElement('div');
  private status: HTMLElement;
  private main: HTMLElement;
  private waiting: HTMLElement;
  private codeInput: HTMLInputElement;
  private localBox: HTMLInputElement;

  constructor(h: MenuHandlers) {
    this.root.className = 'overlay menu';
    const params = new URLSearchParams(location.search);
    this.root.innerHTML = `
      <div class="panel wide">
        <h1>Mittelalter-Duell</h1>
        <p class="muted">Etappe 1 · Grundgerüst &amp; Verbindung</p>
        <section data-s="main">
          <button data-a="host" class="primary">Raum erstellen</button>
          <div class="row">
            <input data-a="code" maxlength="8" placeholder="Raumcode" autocomplete="off" spellcheck="false" />
            <button data-a="join">Raum beitreten</button>
          </div>
          <label class="check"><input type="checkbox" data-a="local" ${params.has('lokal') ? 'checked' : ''}/>
            Lokaltest – zwei Fenster auf diesem Rechner, ohne Internet</label>
          <div class="row later">
            <button disabled title="Etappe 3">Ausrüstung</button>
            <button disabled title="Etappe 5">Profil</button>
            <button disabled title="Etappe 6">Einstellungen</button>
          </div>
        </section>
        <section data-s="waiting" hidden>
          <p data-a="waittext"></p>
          <div class="code" data-a="codeview"></div>
          <button data-a="copy">Code kopieren</button>
          <p class="muted" data-a="waithint"></p>
          <button data-a="cancel">Abbrechen</button>
        </section>
        <p class="status" data-a="status" role="status"></p>
        <details>
          <summary>Steuerung</summary>
          <table class="keys">${ACTION_NAMES.map(([a, n]) =>
            `<tr class="${AVAILABLE_NOW.has(a) ? '' : 'soon'}"><td><kbd data-key="${a}">${controls[a].join('/')}</kbd></td><td>${n}</td></tr>`).join('')}
          </table>
          <p class="muted">Ausgegraute Aktionen kommen ab Etappe 2.</p>
        </details>
      </div>`;
    const q = <T extends HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
    this.status = q('[data-a=status]');
    this.main = q('[data-s=main]');
    this.waiting = q('[data-s=waiting]');
    this.codeInput = q('[data-a=code]');
    this.localBox = q('[data-a=local]');

    q('[data-a=host]').addEventListener('click', () => h.onHost(this.localBox.checked));
    const join = () => {
      const code = this.codeInput.value.trim();
      if (!code) { this.setStatus('Bitte zuerst den Raumcode eingeben.', true); return; }
      h.onJoin(code, this.localBox.checked);
    };
    q('[data-a=join]').addEventListener('click', join);
    this.codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    q('[data-a=cancel]').addEventListener('click', () => h.onCancel());
    q('[data-a=copy]').addEventListener('click', () => {
      const code = q('[data-a=codeview]').textContent ?? '';
      navigator.clipboard?.writeText(code).then(() => this.setStatus('Code kopiert.')).catch(() => {});
    });
    document.body.append(this.root);
    // Beschriftungen nach Tastaturlayout, sobald verfügbar
    setTimeout(() => this.root.querySelectorAll<HTMLElement>('kbd[data-key]').forEach((k) => {
      k.textContent = keyboard.label(k.dataset.key as Action);
    }), 300);
  }

  show(): void {
    this.root.hidden = false;
    this.main.hidden = false;
    this.waiting.hidden = true;
  }

  hide(): void {
    this.root.hidden = true;
  }

  showWaiting(text: string, code: string | null, hint = ''): void {
    this.main.hidden = true;
    this.waiting.hidden = false;
    (this.root.querySelector('[data-a=waittext]') as HTMLElement).textContent = text;
    const cv = this.root.querySelector('[data-a=codeview]') as HTMLElement;
    cv.textContent = code ?? '';
    cv.hidden = code === null;
    (this.root.querySelector('[data-a=copy]') as HTMLElement).hidden = code === null;
    (this.root.querySelector('[data-a=waithint]') as HTMLElement).textContent = hint;
  }

  setStatus(text: string, error = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', error);
  }
}
