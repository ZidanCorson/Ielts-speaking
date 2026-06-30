// Browser speech APIs — free, no external service required.
// SpeechRecognition (mic -> text) works in Chrome/Edge. SpeechSynthesis (TTS) is universal.

type SpeechRecognition = any;

interface RecognitionHandle {
  stop: () => void;
}

export function isRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
}

export function startRecognition(
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
  onEnd: () => void,
  onError?: (message: string) => void
): RecognitionHandle {
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition: SpeechRecognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = "";

  recognition.onresult = (event: any) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    onPartial(finalText + interim);
  };

  recognition.onerror = (event: any) => {
    const map: Record<string, string> = {
      "not-allowed": "Microphone blocked. Allow mic access in your browser and reload.",
      "service-not-allowed": "Microphone blocked. Allow mic access in your browser and reload.",
      "no-speech": "No speech detected — try speaking a bit louder.",
      "audio-capture": "No microphone found. Please connect one.",
      network: "Network issue with speech recognition. Check your connection.",
    };
    // no-speech / aborted are recoverable; only report real failures.
    if (event.error !== "no-speech" && event.error !== "aborted") {
      onError?.(map[event.error] ?? `Speech error: ${event.error}`);
    }
  };

  let stopped = false;
  recognition.onend = () => {
    if (!stopped) {
      // Browser ends sessions on pauses; restart to keep capturing.
      try {
        recognition.start();
        return;
      } catch {
        /* fall through to finish */
      }
    }
    onFinal(finalText.trim());
    onEnd();
  };

  try {
    recognition.start();
  } catch (e) {
    onError?.(e instanceof Error ? e.message : "Could not start microphone.");
  }
  return {
    stop: () => {
      stopped = true;
      recognition.stop();
    },
  };
}

const VOICE_STORAGE_KEY = "ielts.voiceName";

let voices: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  voiceListeners.forEach((fn) => fn());
}
if (typeof window !== "undefined") {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// macOS/Chrome ship many novelty & robotic voices that sound unprofessional.
// Exclude them so only natural, examiner-appropriate voices are offered.
const BLOCKED_VOICE_NAMES = new Set([
  "Albert",
  "Bad News",
  "Bahh",
  "Bells",
  "Boing",
  "Bubbles",
  "Cellos",
  "Deranged",
  "Eddy",
  "Flo",
  "Fred",
  "Good News",
  "Grandma",
  "Grandpa",
  "Jester",
  "Junior",
  "Kathy",
  "Organ",
  "Ralph",
  "Reed",
  "Rocko",
  "Sandy",
  "Shelley",
  "Superstar",
  "Trinoids",
  "Whisper",
  "Wobble",
  "Zarvox",
]);

function isProfessionalVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.trim();
  if (BLOCKED_VOICE_NAMES.has(name)) return false;
  // Drop robotic novelty voices (the eloquence/"com.apple.eloquence" family) and
  // low-quality "compact" variants that sound mechanical.
  if (/eloquence/i.test((v as any).voiceURI ?? "")) return false;
  if (/\b(compact|novelty)\b/i.test(name)) return false;
  return true;
}

// English voices the user can choose from (professional, non-novelty only).
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.startsWith("en") && isProfessionalVoice(v));
}

// Subscribe to voice-list changes (voices load asynchronously in some browsers).
export function onVoicesChanged(listener: () => void): () => void {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

export function getSelectedVoiceName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(VOICE_STORAGE_KEY);
}

export function setSelectedVoiceName(name: string | null): void {
  if (typeof window === "undefined") return;
  if (name) window.localStorage.setItem(VOICE_STORAGE_KEY, name);
  else window.localStorage.removeItem(VOICE_STORAGE_KEY);
}

function getActiveVoice(): SpeechSynthesisVoice | null {
  const chosen = getSelectedVoiceName();
  if (chosen) {
    const match = voices.find((v) => v.name === chosen);
    if (match) return match;
  }
  return pickNaturalVoice();
}

export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = getActiveVoice();
  u.rate = 0.98;
  u.pitch = 1.05;
  window.speechSynthesis.speak(u);
}

// Prefer high-quality / neural voices that sound closer to human; fall back to any English voice.
function pickNaturalVoice(): SpeechSynthesisVoice | null {
  const en = getEnglishVoices();
  if (en.length === 0) return null;
  const preferred = [
    "Google UK English Female",
    "Google US English",
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Sonia",
    "Samantha",
    "Karen",
    "Daniel",
  ];
  for (const name of preferred) {
    const match = en.find((v) => v.name.includes(name));
    if (match) return match;
  }
  // Otherwise favour voices flagged as natural/neural or non-local (cloud) ones.
  const natural = en.find((v) => /natural|neural|enhanced/i.test(v.name) || !v.localService);
  return natural ?? en[0];
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
