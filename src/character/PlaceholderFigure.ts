// Platzhalter-Figur für Etappe 1 (wird später durch die Mixamo-Figur ersetzt).
// Nur Darstellung – keine Spiellogik. Gleiche Schnittstelle wird später die echte Figur haben.
import * as THREE from 'three';
import { balance } from '../core/config';

export class PlaceholderFigure {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private legL: THREE.Object3D;
  private legR: THREE.Object3D;
  private armL: THREE.Object3D;
  private armR: THREE.Object3D;
  private stride = 0;
  private yaw = 0;
  private lastX = 0;
  private lastZ = 0;

  constructor(color: number) {
    const h = balance.character.height;
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3b3128, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a77f, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.35 });

    const legLen = h * 0.47;
    const torsoLen = h * 0.3;

    this.hips.position.y = legLen;
    this.root.add(this.hips);

    // Beine (drehen um die Hüfte)
    const mkLeg = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.11 * side, 0, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, legLen - 0.17, 4, 8), dark);
      leg.position.y = -legLen / 2;
      leg.castShadow = true;
      pivot.add(leg);
      this.hips.add(pivot);
      return pivot;
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

    // Rumpf (Waffenrock in Spielerfarbe)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, torsoLen, 10), cloth);
    torso.position.y = torsoLen / 2;
    torso.castShadow = true;
    this.hips.add(torso);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.25, 10, 1, true), cloth);
    skirt.position.y = -0.08;
    skirt.castShadow = true;
    this.hips.add(skirt);

    // Arme
    const shoulderY = torsoLen - 0.04;
    const armLen = h * 0.33;
    const mkArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.27 * side, shoulderY, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, armLen - 0.13, 4, 8), cloth);
      arm.position.y = -armLen / 2;
      arm.castShadow = true;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
      hand.position.y = -armLen;
      pivot.add(hand);
      this.hips.add(pivot);
      return pivot;
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);

    // Kopf mit einfachem Helm und Visierschlitz – zeigt die Blickrichtung
    const head = new THREE.Group();
    head.position.y = torsoLen + 0.17;
    this.hips.add(head);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), steel);
    helm.scale.set(1, 1.15, 1.05);
    helm.castShadow = true;
    head.add(helm);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.04), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    slit.position.set(0, 0.02, 0.145);
    head.add(slit);

    // Ruhestellung: Arme leicht nach vorn
    this.armL.rotation.x = -0.35;
    this.armR.rotation.x = -0.35;
  }

  /** Position (Boden) und Blickrichtung setzen; Schrittanimation aus der Bewegung ableiten. */
  update(x: number, z: number, fx: number, fz: number, dt: number): void {
    const targetYaw = Math.atan2(fx, fz);
    // Kürzester Drehweg, weich nachgeführt
    let d = targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 15);
    this.root.rotation.y = this.yaw;
    this.root.position.set(x, 0, z);

    const dist = Math.hypot(x - this.lastX, z - this.lastZ);
    this.lastX = x;
    this.lastZ = z;
    const speed = dt > 0 ? dist / dt : 0;
    if (dist > 2) return; // Teleport (z. B. Rundenstart), keine Animation
    this.stride += dist * 5.5;
    const amp = Math.min(1, speed / 2.5) * 0.55;
    const swing = Math.sin(this.stride) * amp;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -0.35 - swing * 0.4;
    this.armR.rotation.x = -0.35 + swing * 0.4;
    this.hips.position.y = balance.character.height * 0.47 + Math.abs(Math.cos(this.stride)) * amp * 0.05;
  }
}
