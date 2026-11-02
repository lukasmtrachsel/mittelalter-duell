// Taktgeber für die Simulation, der auch im Hintergrund weiterläuft.
// requestAnimationFrame pausiert, sobald ein Fenster verdeckt/minimiert ist, und
// setInterval wird im Hintergrund stark gedrosselt. Timer in einem Web Worker
// laufen dagegen weiter – so rechnet der Host auch dann, wenn sein Fenster nicht vorne ist.
const WORKER_SRC = `
let id = null;
onmessage = (e) => {
  if (id !== null) clearInterval(id);
  id = e.data > 0 ? setInterval(() => postMessage(0), e.data) : null;
};`;

export class BackgroundTicker {
  private worker: Worker | null = null;
  private url: string | null = null;
  private fallback: number | null = null;

  constructor(intervalMs: number, onTick: () => void) {
    try {
      this.url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      this.worker = new Worker(this.url);
      this.worker.onmessage = () => onTick();
      this.worker.postMessage(intervalMs);
    } catch {
      // Ohne Worker: normaler Timer (im Hintergrund gedrosselt, aber besser als nichts)
      this.fallback = window.setInterval(onTick, intervalMs);
    }
  }

  stop(): void {
    this.worker?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    if (this.fallback !== null) window.clearInterval(this.fallback);
    this.worker = null;
  }
}
