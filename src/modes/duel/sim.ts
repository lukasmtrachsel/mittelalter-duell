// Physik und Bewegung (Rapier). Dieselbe Funktion läuft beim Host (verbindlich)
// und beim Client (Vorhersage), damit beide zum gleichen Ergebnis kommen.
import RAPIER from '@dimforge/rapier3d-compat';
import { balance } from '../../core/config';
import type { BodyState, MoveInput } from './protocol';

export class Fighter {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  /** Blickrichtung (Einheitsvektor), immer zum Gegner. */
  fx = 1;
  fz = 0;

  constructor(readonly collider: RAPIER.Collider) {}

  get state(): BodyState {
    return [this.x, this.z, this.vx, this.vz];
  }

  setState(s: BodyState): void {
    [this.x, this.z, this.vx, this.vz] = s;
    this.syncCollider();
  }

  setPosition(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.syncCollider();
  }

  syncCollider(): void {
    this.collider.setTranslation({ x: this.x, y: balance.character.height / 2 + 0.02, z: this.z });
  }
}

export class DuelSim {
  readonly world: RAPIER.World;
  readonly fighters: [Fighter, Fighter];
  private controller: RAPIER.KinematicCharacterController;
  private ground: RAPIER.Collider;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const { width, depth, fenceHeight } = balance.arena;

    // Boden
    this.ground = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width, 0.1, depth).setTranslation(0, -0.1, 0));

    // Zaun als vier Wände
    const t = 0.15; // halbe Wandstärke
    const h = fenceHeight / 2;
    const walls: [number, number, number, number][] = [
      [0, -depth / 2 - t, width / 2 + 2 * t, t],
      [0, depth / 2 + t, width / 2 + 2 * t, t],
      [-width / 2 - t, 0, t, depth / 2 + 2 * t],
      [width / 2 + t, 0, t, depth / 2 + 2 * t],
    ];
    for (const [x, z, hx, hz] of walls) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, h, hz).setTranslation(x, h, z));
    }

    // Figuren als Kapseln
    const { radius, height } = balance.character;
    const mk = () => new Fighter(this.world.createCollider(
      RAPIER.ColliderDesc.capsule(height / 2 - radius, radius)));
    this.fighters = [mk(), mk()];
    const d = balance.arena.spawnDistance / 2;
    this.fighters[0].setPosition(-d, 0);
    this.fighters[1].setPosition(d, 0);

    this.controller = this.world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.updateQueries();
  }

  /** Aktualisiert die Kollisionsabfragen nach Positionsänderungen (keine dynamischen Körper → billig). */
  updateQueries(): void {
    this.world.step();
  }

  /** Richtet beide Figuren zueinander aus (Lock-on). */
  faceEachOther(): void {
    const [a, b] = this.fighters;
    faceTowards(a, b.x, b.z);
    faceTowards(b, a.x, a.z);
  }

  /** Ein Simulationsschritt für eine Figur. */
  move(f: Fighter, input: MoveInput, dt: number): void {
    const mv = balance.movement;
    // Richtung zum Gegner aus der Eingabe (so rechnen Host und Client-Vorhersage identisch).
    let fx = input.fx, fz = input.fz;
    const len = Math.hypot(fx, fz);
    if (len < 1e-4) { fx = f.fx; fz = f.fz; } else { fx /= len; fz /= len; }
    const rx = -fz, rz = fx; // rechts = vorwärts × oben

    let fwd = clamp(input.f, -1, 1);
    let side = clamp(input.s, -1, 1);
    const mag = Math.hypot(fwd, side);
    if (mag > 1) { fwd /= mag; side /= mag; }

    const sprinting = input.sprint && fwd > 0;
    const base = sprinting ? mv.sprintSpeed : mv.walkSpeed;
    const fSpeed = fwd * base * (fwd < 0 ? mv.backwardFactor : 1);
    const sSpeed = side * base * mv.strafeFactor;
    const tx = fx * fSpeed + rx * sSpeed;
    const tz = fz * fSpeed + rz * sSpeed;

    // Beschleunigen bzw. Abbremsen in Richtung Zielgeschwindigkeit
    const rate = Math.hypot(tx, tz) > 0.01 ? mv.acceleration : mv.deceleration;
    const dvx = tx - f.vx, dvz = tz - f.vz;
    const dv = Math.hypot(dvx, dvz);
    const maxDv = rate * dt;
    if (dv <= maxDv) { f.vx = tx; f.vz = tz; } else { f.vx += (dvx / dv) * maxDv; f.vz += (dvz / dv) * maxDv; }

    if (Math.abs(f.vx) + Math.abs(f.vz) < 1e-5) { f.vx = 0; f.vz = 0; return; }

    this.controller.computeColliderMovement(
      f.collider,
      { x: f.vx * dt, y: 0, z: f.vz * dt },
      undefined,
      undefined,
      (c) => c.handle !== this.ground.handle,
    );
    const m = this.controller.computedMovement();
    // Gegen Hindernisse bremst die Figur ab, statt Geschwindigkeit aufzustauen.
    f.vx = m.x / dt;
    f.vz = m.z / dt;
    f.setPosition(f.x + m.x, f.z + m.z);
  }

  debugLines(): RAPIER.DebugRenderBuffers {
    return this.world.debugRender();
  }

  dispose(): void {
    this.world.free();
  }
}

export function faceTowards(f: Fighter, tx: number, tz: number): void {
  const dx = tx - f.x, dz = tz - f.z;
  const l = Math.hypot(dx, dz);
  if (l > 1e-3) { f.fx = dx / l; f.fz = dz / l; }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
