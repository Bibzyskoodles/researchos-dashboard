/**
 * Live answer pre-fill for the phone — network-adaptive, offline-guaranteed
 * (constitution 00 §6): live streaming is an OPT-IN enhancement layered on
 * top of capture. The evidence recording is the same WAV file the recorder
 * is writing; this module only *tails* it — reads the bytes appended since
 * the last tick and streams them to the CallScore live WebSocket as raw
 * PCM. Any failure (no signal, socket refused, read error) silently stops
 * the enhancement; the recording and manual flow are never affected.
 *
 * iOS-only for now: live tailing needs a progressively-decodable format,
 * which means LINEARPCM/WAV — expo-av on Android cannot produce that.
 */
import * as FileSystem from 'expo-file-system';
import { CALLSCORE_URL, getToken } from '../api/client';

export const LIVE_SAMPLE_RATE = 16000;
const TAIL_INTERVAL_MS = 4000;
const WAV_HEADER_BYTES = 44;

export interface LiveAnswer { question_key: string; answer: string; confidence: number }

export interface LiveSession {
  stop: () => void;
}

function base64ToBytes(b64: string): Uint8Array {
  // Hermes ships atob (RN >= 0.74); guard anyway — a missing global just
  // means the enhancement is unavailable, never a crash.
  const bin = (globalThis as { atob?: (s: string) => string }).atob?.(b64);
  if (bin === undefined) throw new Error('atob unavailable');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function startLiveSession(opts: {
  projectId: string;
  language: string;
  recordingUri: () => string | null;
  onAnswers: (answers: LiveAnswer[]) => void;
  onState: (state: 'live' | 'unavailable' | 'off') => void;
}): Promise<LiveSession> {
  const token = (await getToken()) || '';
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let position = WAV_HEADER_BYTES; // skip the RIFF header; Deepgram wants raw PCM
  let stopped = false;

  const cleanup = () => {
    if (timer) { clearInterval(timer); timer = null; }
    try { ws?.close(); } catch { /* already closed */ }
    ws = null;
  };

  const stop = () => {
    stopped = true;
    cleanup();
    opts.onState('off');
  };

  try {
    const url =
      `${CALLSCORE_URL.replace(/^http/, 'ws')}/api/v1/live/transcribe` +
      `?project_id=${encodeURIComponent(opts.projectId)}` +
      `&language=${encodeURIComponent(opts.language)}` +
      `&token=${encodeURIComponent(token)}` +
      `&encoding=linear16&sample_rate=${LIVE_SAMPLE_RATE}`;
    ws = new WebSocket(url);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'status') {
          if (msg.state === 'live') opts.onState('live');
          else { opts.onState('unavailable'); stop(); }
        } else if (msg.type === 'answers') {
          opts.onAnswers(msg.answers || []);
        }
      } catch { /* non-JSON frame */ }
    };
    ws.onerror = () => { if (!stopped) { opts.onState('unavailable'); cleanup(); } };
    ws.onclose = () => { if (!stopped) opts.onState('unavailable'); };

    timer = setInterval(() => {
      void (async () => {
        const uri = opts.recordingUri();
        if (!uri || !ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          const info = await FileSystem.getInfoAsync(uri, { size: true });
          const size = info.exists ? (info as { size?: number }).size ?? 0 : 0;
          if (size <= position) return;
          const length = Math.min(size - position, 1_000_000); // bound each read
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64, position, length,
          });
          const bytes = base64ToBytes(b64);
          position += bytes.length;
          ws.send(bytes.buffer);
        } catch { /* transient read/socket issue — next tick retries */ }
      })();
    }, TAIL_INTERVAL_MS);
  } catch {
    opts.onState('unavailable');
    cleanup();
  }

  return { stop };
}
