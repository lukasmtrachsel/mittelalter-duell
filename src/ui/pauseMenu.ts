// Esc-Menü im Kampf. Das Spiel läuft im Hintergrund weiter (Mehrspieler), nur die eigene Eingabe ruht.
export class PauseMenu {
  private root = document.createElement('div');
  isOpen = false;

  constructor(onLeave: () => void) {
    this.root.className = 'overlay pause';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="panel">
        <h2>Menü</h2>
        <p class="muted">Das Spiel läuft weiter – deine Figur bleibt stehen.</p>
        <button data-a="resume">Weiter (Esc)</button>
        <button data-a="leave" class="danger">Kampf verlassen</button>
      </div>`;
    this.root.querySelector('[data-a=resume]')!.addEventListener('click', () => this.toggle(false));
    this.root.querySelector('[data-a=leave]')!.addEventListener('click', onLeave);
    document.body.append(this.root);
  }

  toggle(open = !this.isOpen): void {
    this.isOpen = open;
    this.root.hidden = !open;
    if (!open) (document.activeElement as HTMLElement | null)?.blur();
  }

  dispose(): void {
    this.root.remove();
  }
}
