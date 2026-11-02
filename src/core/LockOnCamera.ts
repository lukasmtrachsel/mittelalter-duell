// Kamera hinter der eigenen Figur, automatisch auf den Gegner ausgerichtet (Lock-on).
import * as THREE from 'three';
import { balance } from './config';

export class LockOnCamera {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private initialized = false;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(balance.camera.fov, 1, 0.1, 300);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(selfX: number, selfZ: number, otherX: number, otherZ: number, dt: number): void {
    const cam = balance.camera;
    let fx = otherX - selfX, fz = otherZ - selfZ;
    const dist = Math.hypot(fx, fz);
    if (dist < 1e-3) { fx = 1; fz = 0; } else { fx /= dist; fz /= dist; }
    const rx = -fz, rz = fx;

    const targetPos = new THREE.Vector3(
      selfX - fx * cam.distanceBehind + rx * cam.shoulderOffset,
      cam.height,
      selfZ - fz * cam.distanceBehind + rz * cam.shoulderOffset,
    );
    // Blickpunkt: zwischen eigener Figur und Gegner, auf Brusthöhe
    const k = Math.min(0.5, 2.5 / Math.max(dist, 0.01));
    const targetLook = new THREE.Vector3(
      selfX + (otherX - selfX) * (1 - k * 0.5) * 0.6,
      1.25,
      selfZ + (otherZ - selfZ) * (1 - k * 0.5) * 0.6,
    );

    if (!this.initialized) {
      this.pos.copy(targetPos);
      this.look.copy(targetLook);
      this.initialized = true;
    } else {
      const a = 1 - Math.exp(-cam.smoothing * dt);
      this.pos.lerp(targetPos, a);
      this.look.lerp(targetLook, a);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
