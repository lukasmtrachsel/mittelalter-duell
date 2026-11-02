// Puffer für Zustände vom Host. Der Gegner wird leicht verzögert und zwischen
// zwei bekannten Zuständen interpoliert dargestellt, damit er trotz Latenz flüssig läuft.

export interface Sample {
  /** Host-Zeit in ms */
  t: number;
  x: number;
  z: number;
}

export class SnapshotBuffer {
  private samples: Sample[] = [];
  /** Geschätzter Versatz lokale Zeit − Host-Zeit. */
  private offset: number | null = null;

  push(hostTime: number, x: number, z: number): void {
    const now = performance.now();
    const o = now - hostTime;
    // Kleinster beobachteter Versatz ≈ schnellste Übertragung; langsam nach oben nachführen.
    if (this.offset === null || o < this.offset) this.offset = o;
    else this.offset += (o - this.offset) * 0.01;
    const last = this.samples[this.samples.length - 1];
    if (last && hostTime <= last.t) return;
    this.samples.push({ t: hostTime, x, z });
    if (this.samples.length > 60) this.samples.shift();
  }

  get size(): number {
    return this.samples.length;
  }

  /** Position zum Zeitpunkt (jetzt − delayMs) in Host-Zeit. */
  sample(delayMs: number): { x: number; z: number } | null {
    if (this.samples.length === 0 || this.offset === null) return null;
    const t = performance.now() - this.offset - delayMs;
    const s = this.samples;
    if (t <= s[0].t) return s[0];
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1], b = s[i];
      if (t >= a.t && t <= b.t) {
        const k = (t - a.t) / (b.t - a.t || 1);
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
      }
    }
    // Keine neueren Daten: letzte bekannte Position halten (keine Extrapolation).
    return s[s.length - 1];
  }
}
