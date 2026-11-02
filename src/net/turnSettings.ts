// TURN-Server, die der Spieler im Menü einträgt. Sie werden nur im Browser
// (localStorage) gespeichert, damit Zugangsdaten nicht im öffentlichen Repository landen.
const KEY = 'mittelalter-duell.turnServers';

export function loadTurnServers(): RTCIceServer[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseTurnServers(raw) : [];
  } catch {
    return [];
  }
}

export function saveTurnServers(text: string): RTCIceServer[] {
  const list = text.trim() ? parseTurnServers(text) : [];
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch { /* privater Modus o. Ä. */ }
  return list;
}

/** Akzeptiert die JSON-Liste, wie sie z. B. Metered anzeigt (iceServers-Array oder Objekt mit iceServers). */
export function parseTurnServers(text: string): RTCIceServer[] {
  let data: unknown = JSON.parse(text.trim().replace(/;\s*$/, ''));
  if (data && typeof data === 'object' && !Array.isArray(data) && 'iceServers' in data) {
    data = (data as { iceServers: unknown }).iceServers;
  }
  if (!Array.isArray(data)) throw new Error('Erwartet wird eine Liste [ { "urls": …, "username": …, "credential": … } ].');
  const out: RTCIceServer[] = [];
  for (const s of data) {
    if (!s || typeof s !== 'object' || !('urls' in s)) throw new Error('Jeder Eintrag braucht "urls".');
    const e = s as RTCIceServer;
    const urls = Array.isArray(e.urls) ? e.urls : [e.urls];
    // Nur TURN-Einträge übernehmen (STUN ist schon eingebaut)
    const turn = urls.filter((u) => /^turns?:/i.test(u));
    if (turn.length === 0) continue;
    out.push({ urls: turn, username: e.username, credential: e.credential });
  }
  return out;
}
