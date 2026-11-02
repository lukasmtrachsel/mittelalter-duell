// Zentraler Zugriff auf alle Daten aus /data. Werte nie fest im Code eintragen.
import balanceJson from '../../data/balance.json';
import controlsJson from '../../data/controls.json';
import networkJson from '../../data/network.json';

export type Balance = typeof balanceJson;
export type NetworkConfig = typeof networkJson & {
  turnServers: RTCIceServer[];
  stunServers: RTCIceServer[];
};

export type Action = Exclude<keyof typeof controlsJson, '_hinweis'>;
export type Controls = Record<Action, string[]>;

export const balance: Balance = balanceJson;
export const network: NetworkConfig = networkJson as NetworkConfig;

const { _hinweis: _unused, ...bindings } = controlsJson;
export const controls: Controls = bindings;

/** Simulierte Latenz für Tests: URL-Parameter ?lag=120&jitter=20 überschreibt network.json. */
export function simulatedLatency(): { latency: number; jitter: number } {
  const params = new URLSearchParams(location.search);
  const lag = Number(params.get('lag') ?? network.simulatedLatencyMs) || 0;
  const jitter = Number(params.get('jitter') ?? network.simulatedJitterMs) || 0;
  return { latency: Math.max(0, lag), jitter: Math.max(0, jitter) };
}
