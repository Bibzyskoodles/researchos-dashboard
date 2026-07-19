import { adaApi } from './api';

// Shared by GuidedOverlay.tsx and MeetingAdaPage.tsx, which previously each
// carried an identical copy of this function that called ElevenLabs
// directly from the browser with the API key read from
// REACT_APP_ELEVENLABS_KEY — baked into the public JS bundle and
// extractable by anyone via devtools (quota/billing theft). The key now
// lives only on the backend (fieldscore-backend's /ada/speak route); this
// just calls that instead, with the same Web Speech API fallback as before.
export async function speakText(
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  const clean = text.replace(/\n/g, ' ').trim();
  if (!clean) { onEnd?.(); return; }

  onStart?.();

  const stopPrev = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };

  const playBlob = (blob: Blob): Promise<boolean> =>
    new Promise(resolve => {
      try {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); resolve(true); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(false); };
        audio.play().catch(() => resolve(false));
      } catch { resolve(false); }
    });

  try {
    stopPrev();
    const res = await adaApi.speak(clean);
    if (await playBlob(res.data as Blob)) return;
  } catch { /* server voice unavailable/unconfigured — fall through */ }

  const synth = window.speechSynthesis;
  if (!synth) { onEnd?.(); return; }
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1.0;
  const voices = synth.getVoices();
  const preferred = voices.find(v => /google.*female/i.test(v.name) && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (preferred) utt.voice = preferred;
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  if (synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => { synth.onvoiceschanged = null; synth.speak(utt); };
  } else {
    synth.speak(utt);
  }
}
