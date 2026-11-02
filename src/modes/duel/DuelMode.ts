// 1-gegen-1-Duell. Etappe 1: Bewegung und Synchronisation.
//
// Host (Schiedsrichter): simuliert beide Figuren verbindlich, eigene Eingabe direkt,
//   Client-Eingaben aus einer Warteschlange (eine pro Tick → gleichmäßige Bewegung).
// Client: sagt die eigene Bewegung sofort voraus, gleicht mit dem Host-Zustand ab
//   (zurücksetzen + unbestätigte Eingaben erneut anwenden) und zeigt den Gegner
//   leicht verzögert interpoliert an.
import * as THREE from 'three';
import { balance } from '../../core/config';
import { keyboard } from '../../core/input';
import { LockOnCamera } from '../../core/LockOnCamera';
import type { GameMode, ModeContext } from '../../core/mode';
import { PlaceholderFigure } from '../../character/PlaceholderFigure';
import { SnapshotBuffer } from '../../net/interpolation';
import { DuelHud } from '../../ui/hud';
import { PauseMenu } from '../../ui/pauseMenu';
import { buildArena } from './arena';
import { isDuelMessage, round3, type DuelMessage, type MoveInput, type BodyState } from './protocol';
import { DuelSim, faceTowards, type Fighter } from './sim';

const PLAYER_COLORS = [0xa8322b, 0x2c5aa0]; // Host rot, Gast blau

export async function createDuelMode(ctx: ModeContext): Promise<GameMode> {
  return new DuelMode(ctx);
}

class DuelMode implements GameMode {
  readonly id = 'duel';
  private scene = new THREE.Scene();
  private cam = new LockOnCamera();
  private sim = new DuelSim();
  private figures: [PlaceholderFigure, PlaceholderFigure];
  private hud: DuelHud;
  private pause: PauseMenu;
  private readonly me: 0 | 1;
  private readonly other: 0 | 1;
  private readonly step = 1 / balance.simulation.tickRate;
  private acc = 0;
  private tick = 0;
  private readonly startTime = performance.now();
  private prev: [number, number][] = [[0, 0], [0, 0]];
  private unsubscribe: (() => void)[] = [];
  private debug = false;
  private debugLines: THREE.LineSegments | null = null;
  private fps = 60;
  private simMs = 0;
  private renderMs = 0;

  // Host
  private clientQueue: MoveInput[] = [];
  private lastClientSeq = 0;
  private lastQueuedSeq = 0;

  // Client
  private seq = 0;
  private pending: MoveInput[] = [];
  private opponentBuf = new SnapshotBuffer();
  private correction = { x: 0, z: 0 };
  private lastCorrection = 0;
  private corrections = 0;

  constructor(private ctx: ModeContext) {
    this.me = ctx.role === 'host' ? 0 : 1;
    this.other = this.me === 0 ? 1 : 0;

    buildArena(this.scene);
    this.figures = [new PlaceholderFigure(PLAYER_COLORS[0]), new PlaceholderFigure(PLAYER_COLORS[1])];
    for (const f of this.figures) this.scene.add(f.root);
    this.sim.faceEachOther();
    this.savePrev();

    this.hud = new DuelHud();
    this.pause = new PauseMenu(() => ctx.exit());
    this.unsubscribe.push(keyboard.onPress((a) => { if (a === 'menu') this.pause.toggle(); }));

    ctx.transport.onMessage = (m) => { if (isDuelMessage(m)) this.onMessage(m); };
    ctx.transport.onClose = (reason) => ctx.exit(reason);

    const { width, height } = ctx.renderer.domElement;
    this.resize(width, height);
  }

  // -------------------------------------------------------------------------

  frame(dt: number): void {
    const t0 = performance.now();
    this.fps += ((dt > 0 ? 1 / dt : 60) - this.fps) * 0.05;

    this.acc += dt;
    let n = 0;
    while (this.acc >= this.step && n < 10) {
      this.fixedTick();
      this.acc -= this.step;
      n++;
    }
    if (n === 10) this.acc = 0; // Rückstand verwerfen (z. B. nach Tab-Wechsel)
    const t1 = performance.now();

    this.render(dt);
    const t2 = performance.now();
    this.simMs += (t1 - t0 - this.simMs) * 0.1;
    this.renderMs += (t2 - t1 - this.renderMs) * 0.1;
    this.hud.update({
      ping: this.ctx.transport.ping,
      debug: this.debug ? this.debugText() : null,
    });
  }

  private fixedTick(): void {
    this.savePrev();
    if (this.ctx.role === 'host') this.hostTick();
    else this.clientTick();
    this.tick++;
  }

  private hostTick(): void {
    const [host, client] = this.sim.fighters;
    this.sim.move(host, this.readInput(host, client.x, client.z), this.step);

    // Client-Eingaben: eine pro Tick; wächst die Schlange, wird aufgeholt.
    const next = this.clientQueue.shift();
    if (next) this.applyClientInput(next);
    while (this.clientQueue.length > balance.simulation.maxInputQueue) {
      this.applyClientInput(this.clientQueue.shift()!);
    }

    this.sim.updateQueries();
    this.sim.faceEachOther();

    const every = Math.max(1, Math.round(balance.simulation.tickRate / balance.simulation.snapshotRate));
    if (this.tick % every === 0) {
      const r = (s: BodyState): BodyState => [round3(s[0]), round3(s[1]), round3(s[2]), round3(s[3])];
      this.send({
        k: 'state',
        tick: this.tick,
        ht: Math.round(performance.now() - this.startTime),
        p: [r(host.state), r(client.state)],
        ack: this.lastClientSeq,
      });
    }
  }

  private applyClientInput(i: MoveInput): void {
    this.sim.move(this.sim.fighters[1], i, this.step);
    this.lastClientSeq = i.seq;
  }

  private clientTick(): void {
    const meF = this.sim.fighters[1];
    const opp = this.sim.fighters[0];
    // Gegner an seiner interpolierten Position als Hindernis für die Vorhersage
    const o = this.opponentBuf.sample(balance.simulation.interpolationDelayMs);
    if (o) opp.setPosition(o.x, o.z);
    this.sim.updateQueries();

    const input = this.readInput(meF, opp.x, opp.z);
    input.seq = ++this.seq;
    this.pending.push(input);
    this.send({ k: 'input', i: input });
    this.sim.move(meF, input, this.step);
    this.sim.faceEachOther();
  }

  private onMessage(m: DuelMessage): void {
    if (m.k === 'input' && this.ctx.role === 'host') {
      if (m.i.seq > this.lastQueuedSeq) {
        this.lastQueuedSeq = m.i.seq;
        this.clientQueue.push(m.i);
      }
    } else if (m.k === 'state' && this.ctx.role === 'client') {
      this.opponentBuf.push(m.ht, m.p[0][0], m.p[0][1]);
      this.reconcile(m.p[1], m.ack);
    }
  }

  /** Eigene Vorhersage mit dem verbindlichen Host-Zustand abgleichen. */
  private reconcile(authoritative: BodyState, ack: number): void {
    const meF = this.sim.fighters[1];
    const bx = meF.x, bz = meF.z;
    meF.setState(authoritative);
    this.pending = this.pending.filter((i) => i.seq > ack);
    for (const i of this.pending) this.sim.move(meF, i, this.step);

    const dx = bx - meF.x, dz = bz - meF.z;
    const err = Math.hypot(dx, dz);
    this.lastCorrection = err;
    if (err > 0.01) this.corrections++;
    if (err > 1.5) {
      this.correction.x = 0; // große Abweichung: direkt springen
      this.correction.z = 0;
    } else {
      // Sichtbaren Sprung vermeiden: Fehler weich ausblenden
      this.correction.x += dx;
      this.correction.z += dz;
    }
    this.prev[1][0] -= dx;
    this.prev[1][1] -= dz;
  }

  private readInput(self: Fighter, ox: number, oz: number): MoveInput {
    faceTowards(self, ox, oz);
    const active = !this.pause.isOpen;
    const k = (a: Parameters<typeof keyboard.isDown>[0]) => (active && keyboard.isDown(a) ? 1 : 0);
    return {
      seq: 0,
      f: k('moveForward') - k('moveBack'),
      s: k('moveRight') - k('moveLeft'),
      sprint: k('sprint') === 1,
      fx: round3(self.fx),
      fz: round3(self.fz),
    };
  }

  private send(m: DuelMessage): void {
    this.ctx.transport.send(m);
  }

  private savePrev(): void {
    for (const i of [0, 1] as const) {
      this.prev[i][0] = this.sim.fighters[i].x;
      this.prev[i][1] = this.sim.fighters[i].z;
    }
  }

  // -------------------------------------------------------------------------

  private render(dt: number): void {
    const alpha = this.acc / this.step;
    const pos: [number, number][] = [[0, 0], [0, 0]];
    for (const i of [0, 1] as const) {
      const f = this.sim.fighters[i];
      pos[i] = [this.prev[i][0] + (f.x - this.prev[i][0]) * alpha, this.prev[i][1] + (f.z - this.prev[i][1]) * alpha];
    }
    if (this.ctx.role === 'client') {
      // Eigene Figur: Vorhersage + weich ausgeblendeter Korrekturfehler
      const decay = Math.exp(-10 * dt);
      this.correction.x *= decay;
      this.correction.z *= decay;
      pos[1][0] += this.correction.x;
      pos[1][1] += this.correction.z;
      // Gegner: interpoliert aus dem Puffer
      const o = this.opponentBuf.sample(balance.simulation.interpolationDelayMs);
      if (o) pos[0] = [o.x, o.z];
    }

    for (const i of [0, 1] as const) {
      const j = i === 0 ? 1 : 0;
      let fx = pos[j][0] - pos[i][0], fz = pos[j][1] - pos[i][1];
      const l = Math.hypot(fx, fz) || 1;
      fx /= l; fz /= l;
      this.figures[i].update(pos[i][0], pos[i][1], fx, fz, dt);
    }

    const s = pos[this.me], o = pos[this.other];
    this.cam.update(s[0], s[1], o[0], o[1], dt);
    if (this.debug) this.updateDebugLines();
    this.ctx.renderer.render(this.scene, this.cam.camera);
  }

  private debugText(): string {
    const t = this.ctx.transport;
    const f = this.sim.fighters;
    const lines = [
      `Rolle: ${this.ctx.role === 'host' ? 'Host (Schiedsrichter)' : 'Client'}  ·  Verbindung: ${t.path}`,
      `FPS: ${this.fps.toFixed(0)}  ·  Simulation: ${this.simMs.toFixed(1)} ms  ·  Grafik: ${this.renderMs.toFixed(1)} ms  ·  Tick: ${this.tick}`,
      `Ping: ${t.ping.toFixed(0)} ms${t.simulatedLatencyMs ? `  (simuliert +${t.simulatedLatencyMs} ms je Richtung)` : ''}`,
      `Ich:     x ${f[this.me].x.toFixed(2)}  z ${f[this.me].z.toFixed(2)}  v ${Math.hypot(f[this.me].vx, f[this.me].vz).toFixed(2)} m/s`,
      `Gegner:  x ${f[this.other].x.toFixed(2)}  z ${f[this.other].z.toFixed(2)}  Abstand ${Math.hypot(f[0].x - f[1].x, f[0].z - f[1].z).toFixed(2)} m`,
    ];
    if (this.ctx.role === 'host') {
      lines.push(`Eingabe-Warteschlange Client: ${this.clientQueue.length}  ·  letzte Eingabe #${this.lastClientSeq}`);
    } else {
      lines.push(`Unbestätigte Eingaben: ${this.pending.length}  ·  Zustandspuffer: ${this.opponentBuf.size}`);
      lines.push(`Letzte Korrektur: ${(this.lastCorrection * 100).toFixed(1)} cm  ·  Korrekturen gesamt: ${this.corrections}`);
    }
    lines.push('Trefferzonen, Waffen-Kollision, Ausdauer, Schaden: ab Etappe 2');
    return lines.join('\n');
  }

  private updateDebugLines(): void {
    const { vertices, colors } = this.sim.debugLines();
    if (!this.debugLines) {
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true });
      this.debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
      this.debugLines.renderOrder = 999;
      this.debugLines.frustumCulled = false;
      this.scene.add(this.debugLines);
    }
    const g = this.debugLines.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.debugLines.visible = true;
  }

  setDebug(on: boolean): void {
    this.debug = on;
    if (!on && this.debugLines) this.debugLines.visible = false;
  }

  resize(width: number, height: number): void {
    this.cam.resize(width, height);
  }

  dispose(): void {
    this.unsubscribe.forEach((u) => u());
    this.ctx.transport.onMessage = () => {};
    this.ctx.transport.onClose = () => {};
    this.hud.dispose();
    this.pause.dispose();
    this.sim.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose();
    });
  }
}
