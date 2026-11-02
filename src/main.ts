// Einstiegspunkt: Renderer, Menü, Verbindungsaufbau und Spielschleife.
import './ui/style.css';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { keyboard } from './core/input';
import { getMode, registerMode, type GameMode, type Role } from './core/mode';
import { createDuelMode } from './modes/duel/DuelMode';
import { ConnectError, hostRoom, joinRoom, type HostHandle, type Transport } from './net/transport';
import { MainMenu } from './ui/menu';

registerMode('duel', createDuelMode);
// Später: registerMode('joust', createJoustMode);

await RAPIER.init();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.append(renderer.domElement);

let mode: GameMode | null = null;
let debug = false;
let hostHandle: HostHandle | null = null;
let attempt = 0; // erhöht sich bei Abbruch, damit späte Verbindungen verworfen werden

const menu = new MainMenu({
  onHost(local) {
    const my = ++attempt;
    menu.setStatus('');
    menu.showWaiting('Raum wird erstellt …', null);
    hostHandle = hostRoom(local, (code) => {
      if (my !== attempt) return;
      menu.showWaiting(
        'Raum erstellt. Gib deinem Mitspieler diesen Code:',
        code,
        local
          ? 'Lokaltest: Öffne ein zweites Fenster mit derselben Adresse, hake „Lokaltest“ an und tritt mit dem Code bei.'
          : 'Warte auf Mitspieler …',
      );
    });
    hostHandle.connected.then(
      (t) => { if (my === attempt) startMode('duel', t, 'host'); else t.close(); },
      (e) => { if (my === attempt) failed(e); },
    );
  },
  onJoin(code, local) {
    const my = ++attempt;
    menu.setStatus('');
    menu.showWaiting('Verbinde …', null, local ? 'Lokaltest' : 'Das kann einige Sekunden dauern.');
    joinRoom(code, local).then(
      (t) => { if (my === attempt) startMode('duel', t, 'client'); else t.close(); },
      (e) => { if (my === attempt) failed(e); },
    );
  },
  onCancel() {
    attempt++;
    hostHandle?.cancel();
    hostHandle = null;
    menu.show();
    menu.setStatus('');
  },
});

function failed(e: unknown): void {
  hostHandle = null;
  menu.show();
  const msg = e instanceof ConnectError ? e.message : `Unerwarteter Fehler: ${String(e)}`;
  menu.setStatus(msg, true);
  console.error(e);
}

async function startMode(id: string, transport: Transport, role: Role): Promise<void> {
  hostHandle = null;
  menu.hide();
  (document.activeElement as HTMLElement | null)?.blur();
  try {
    mode = await getMode(id)({ renderer, transport, role, exit: (msg) => exitMode(transport, msg) });
    mode.setDebug(debug);
    resize();
  } catch (e) {
    transport.close();
    failed(e);
  }
}

function exitMode(transport: Transport, message?: string): void {
  mode?.dispose();
  mode = null;
  transport.close();
  renderer.clear();
  menu.show();
  menu.setStatus(message ?? '', Boolean(message));
}

keyboard.onPress((a) => {
  if (a === 'debug') {
    debug = !debug;
    mode?.setDebug(debug);
  }
});

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  mode?.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  mode?.frame(dt);
});
