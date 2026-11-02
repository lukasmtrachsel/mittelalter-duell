// Gemeinsame Netzwerkschicht für alle Spielmodi.
// - PeerJS (WebRTC) übers Internet
// - Lokaltest: BroadcastChannel zwischen zwei Fenstern desselben Browsers (ohne Internet)
// Ping, Heartbeat und simulierte Latenz werden hier für alle Modi erledigt.
import { Peer, type DataConnection } from 'peerjs';
import { network, simulatedLatency } from '../core/config';

/** Rohkanal, über den beliebige JSON-Daten laufen. */
interface RawChannel {
  send(data: unknown): void;
  onData: (data: unknown) => void;
  onClose: (reason: string) => void;
  close(): void;
  describe(): Promise<string>;
}

type Internal = { __k: 'ping'; t: number } | { __k: 'pong'; t: number } | { __k: 'bye' };

function isInternal(d: unknown): d is Internal {
  return typeof d === 'object' && d !== null && '__k' in d;
}

export class Transport {
  /** Gemessene Rundlaufzeit in ms (geglättet). */
  ping = 0;
  onMessage: (msg: unknown) => void = () => {};
  onClose: (reason: string) => void = () => {};
  private closed = false;
  private lastReceived = performance.now();
  private timer: number;
  private deliverAt = 0;
  private sim = simulatedLatency();
  private pathInfo = '…';

  constructor(private raw: RawChannel, readonly kind: 'peer' | 'local') {
    raw.onData = (d) => this.receive(d);
    raw.onClose = (reason) => this.shutdown(reason);
    this.timer = window.setInterval(() => this.tick(), network.pingIntervalMs);
    window.addEventListener('pagehide', this.onPageHide);
    this.refreshPath();
  }

  get simulatedLatencyMs(): number {
    return this.sim.latency;
  }

  /** Verbindungsweg für die Debug-Anzeige: direkt, TURN-Relay oder lokal. */
  get path(): string {
    return this.pathInfo;
  }

  send(msg: unknown): void {
    if (!this.closed) this.raw.send(msg);
  }

  close(): void {
    if (this.closed) return;
    try { this.raw.send({ __k: 'bye' } satisfies Internal); } catch { /* egal */ }
    this.shutdown('Verbindung beendet.');
  }

  private onPageHide = (): void => this.close();

  private receive(d: unknown): void {
    // Simulierte Latenz (nur zum Testen): Reihenfolge bleibt erhalten.
    if (this.sim.latency > 0 || this.sim.jitter > 0) {
      const now = performance.now();
      const at = Math.max(this.deliverAt, now + this.sim.latency + Math.random() * this.sim.jitter);
      this.deliverAt = at;
      window.setTimeout(() => this.handle(d), at - now);
    } else {
      this.handle(d);
    }
  }

  private handle(d: unknown): void {
    if (this.closed) return;
    this.lastReceived = performance.now();
    if (isInternal(d)) {
      if (d.__k === 'ping') this.raw.send({ __k: 'pong', t: d.t } satisfies Internal);
      else if (d.__k === 'pong') {
        const rtt = performance.now() - d.t;
        this.ping = this.ping === 0 ? rtt : this.ping * 0.7 + rtt * 0.3;
      } else if (d.__k === 'bye') this.shutdown('Der Mitspieler hat das Spiel verlassen.');
      return;
    }
    this.onMessage(d);
  }

  private tick(): void {
    if (this.closed) return;
    this.raw.send({ __k: 'ping', t: performance.now() } satisfies Internal);
    if (performance.now() - this.lastReceived > network.heartbeatTimeoutMs) {
      this.shutdown('Verbindung verloren (keine Antwort mehr vom Mitspieler).');
    }
  }

  private async refreshPath(): Promise<void> {
    try { this.pathInfo = await this.raw.describe(); } catch { this.pathInfo = 'unbekannt'; }
  }

  private shutdown(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onPageHide);
    this.raw.close();
    this.onClose(reason);
  }
}

// ---------------------------------------------------------------------------
// Raumcode

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O/1/I

export function newRoomCode(): string {
  let s = '';
  for (let i = 0; i < network.roomCodeLength; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class ConnectError extends Error {}

const MSG = {
  strictNetwork:
    'Die direkte Verbindung kam nicht zustande. Wahrscheinlich blockiert ein strenges Netzwerk ' +
    '(z. B. Schul- oder Firmen-WLAN) Peer-to-Peer-Verbindungen. Versucht ein anderes Netz ' +
    '(z. B. Handy-Hotspot) oder tragt einen TURN-Server in data/network.json ein.',
  server:
    'Der PeerJS-Vermittlungsserver ist nicht erreichbar. Bitte Internetverbindung prüfen. ' +
    'Manche Netzwerke (Schul-/Firmen-WLAN) blockieren ihn.',
  browser: 'Dieser Browser unterstützt WebRTC nicht. Bitte aktuellen Chrome, Edge oder Firefox verwenden.',
};

function iceServers(): RTCIceServer[] {
  // TURN steht mit in der Liste, ICE bevorzugt aber immer direkte Wege (host/STUN).
  // Ein TURN-Relay wird nur gewählt, wenn keine direkte Verbindung möglich ist.
  return [...network.stunServers, ...network.turnServers];
}

function peerErrorMessage(type: string, code: string): string {
  switch (type) {
    case 'peer-unavailable':
      return `Raum „${code}“ nicht gefunden. Ist der Code richtig und hat der Host den Raum noch offen?`;
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return MSG.server;
    case 'browser-incompatible':
      return MSG.browser;
    case 'webrtc':
    case 'negotiation-failed':
      return MSG.strictNetwork;
    default:
      return `Verbindungsfehler (${type}).`;
  }
}

function wrapPeerConnection(conn: DataConnection, peer: Peer): RawChannel {
  const raw: RawChannel = {
    send: (d) => conn.send(d),
    onData: () => {},
    onClose: () => {},
    close: () => {
      try { conn.close(); } catch { /* egal */ }
      peer.destroy();
    },
    describe: async () => {
      const pc = conn.peerConnection;
      if (!pc) return 'unbekannt';
      const stats = await pc.getStats();
      let localId = '';
      stats.forEach((s) => {
        if (s.type === 'candidate-pair' && (s.nominated || s.selected) && s.state === 'succeeded') {
          localId = s.localCandidateId;
        }
      });
      const local = localId ? stats.get(localId) : undefined;
      if (!local) return 'unbekannt';
      return local.candidateType === 'relay' ? 'TURN-Relay' : 'direkt (P2P)';
    },
  };
  conn.on('data', (d) => raw.onData(d));
  conn.on('close', () => raw.onClose('Verbindung zum Mitspieler wurde getrennt.'));
  conn.on('error', () => raw.onClose('Verbindungsfehler.'));
  watchIce(conn, (reason) => raw.onClose(reason));
  return raw;
}

function watchIce(conn: DataConnection, onFail: (reason: string) => void): void {
  const attach = () => {
    const pc = conn.peerConnection;
    if (!pc) { window.setTimeout(attach, 100); return; }
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed') onFail(MSG.strictNetwork);
    });
  };
  attach();
}

export interface HostHandle {
  /** Erfüllt sich, sobald der Mitspieler verbunden ist. */
  connected: Promise<Transport>;
  cancel(): void;
}

/** Raum erstellen. onCode wird aufgerufen, sobald der Code feststeht. */
export function hostRoom(local: boolean, onCode: (code: string) => void): HostHandle {
  return local ? hostLocal(onCode) : hostPeer(onCode);
}

export function joinRoom(code: string, local: boolean): Promise<Transport> {
  return local ? joinLocal(code) : joinPeer(code);
}

function hostPeer(onCode: (code: string) => void): HostHandle {
  let peer: Peer | null = null;
  let cancelled = false;
  let paired = false;
  const connected = new Promise<Transport>((resolve, reject) => {
    const open = (attempt: number) => {
      const code = newRoomCode();
      peer = new Peer(network.peerIdPrefix + code, { config: { iceServers: iceServers() }, debug: 1 });
      const p = peer;
      p.on('open', () => onCode(code));
      p.on('error', (err) => {
        if (paired || cancelled) return;
        if (err.type === 'unavailable-id' && attempt < 5) {
          p.destroy();
          open(attempt + 1);
          return;
        }
        p.destroy();
        reject(new ConnectError(peerErrorMessage(err.type, code)));
      });
      p.on('connection', (conn) => {
        if (paired) { conn.close(); return; } // Raum ist voll
        conn.on('open', () => {
          if (paired) { conn.close(); return; }
          paired = true;
          resolve(new Transport(wrapPeerConnection(conn, p), 'peer'));
        });
      });
    };
    open(0);
  });
  return {
    connected,
    cancel: () => {
      cancelled = true;
      if (!paired) peer?.destroy();
    },
  };
}

function joinPeer(rawCode: string): Promise<Transport> {
  const code = normalizeCode(rawCode);
  return new Promise<Transport>((resolve, reject) => {
    const peer = new Peer({ config: { iceServers: iceServers() }, debug: 1 });
    let done = false;
    const fail = (msg: string) => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      peer.destroy();
      reject(new ConnectError(msg));
    };
    const timeout = window.setTimeout(() => fail(MSG.strictNetwork), network.connectTimeoutMs);
    peer.on('error', (err) => fail(peerErrorMessage(err.type, code)));
    peer.on('open', () => {
      const conn = peer.connect(network.peerIdPrefix + code, { reliable: true, serialization: 'json' });
      watchIce(conn, (reason) => fail(reason));
      conn.on('open', () => {
        if (done) return;
        done = true;
        window.clearTimeout(timeout);
        resolve(new Transport(wrapPeerConnection(conn, peer), 'peer'));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Lokaltest: zwei Fenster/Tabs desselben Browsers über BroadcastChannel.

type LocalMsg =
  | { k: 'hello'; from: string }
  | { k: 'welcome'; to: string }
  | { k: 'full'; to: string }
  | { k: 'd'; to: string; data: unknown };

function localChannel(ch: BroadcastChannel, me: string, other: string): RawChannel {
  const raw: RawChannel = {
    send: (data) => ch.postMessage({ k: 'd', to: other, data } satisfies LocalMsg),
    onData: () => {},
    onClose: () => {},
    close: () => ch.close(),
    describe: async () => 'lokal (gleicher Rechner)',
  };
  ch.onmessage = (e: MessageEvent<LocalMsg>) => {
    const m = e.data;
    if (m.k === 'd' && m.to === me) raw.onData(m.data);
  };
  return raw;
}

function hostLocal(onCode: (code: string) => void): HostHandle {
  const code = newRoomCode();
  const ch = new BroadcastChannel('mittelalter-duell-local-' + code);
  let paired = false;
  const connected = new Promise<Transport>((resolve) => {
    ch.onmessage = (e: MessageEvent<LocalMsg>) => {
      const m = e.data;
      if (m.k !== 'hello') return;
      if (paired) { ch.postMessage({ k: 'full', to: m.from } satisfies LocalMsg); return; }
      paired = true;
      ch.postMessage({ k: 'welcome', to: m.from } satisfies LocalMsg);
      resolve(new Transport(localChannel(ch, 'host', m.from), 'local'));
    };
  });
  queueMicrotask(() => onCode(code));
  return { connected, cancel: () => { if (!paired) ch.close(); } };
}

function joinLocal(rawCode: string): Promise<Transport> {
  const code = normalizeCode(rawCode);
  const me = 'client-' + Math.random().toString(36).slice(2, 8);
  const ch = new BroadcastChannel('mittelalter-duell-local-' + code);
  return new Promise<Transport>((resolve, reject) => {
    const hello = window.setInterval(() => ch.postMessage({ k: 'hello', from: me } satisfies LocalMsg), 250);
    const finish = () => { window.clearInterval(hello); window.clearTimeout(timeout); };
    const timeout = window.setTimeout(() => {
      finish();
      ch.close();
      reject(new ConnectError(
        `Kein Lokaltest-Raum „${code}“ gefunden. Beide Fenster müssen im selben Browser offen sein, ` +
        'und beim Host muss „Lokaltest“ ebenfalls angehakt sein.'));
    }, 3000);
    ch.onmessage = (e: MessageEvent<LocalMsg>) => {
      const m = e.data;
      if (m.k === 'welcome' && m.to === me) {
        finish();
        resolve(new Transport(localChannel(ch, me, 'host'), 'local'));
      } else if (m.k === 'full' && m.to === me) {
        finish();
        ch.close();
        reject(new ConnectError('Dieser Raum ist schon voll.'));
      }
    };
    ch.postMessage({ k: 'hello', from: me } satisfies LocalMsg);
  });
}
