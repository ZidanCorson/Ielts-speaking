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
  } catch (e: any) {
    onError?.(e?.message ?? "Could not start microphone.");
  }
  return {
    stop: () => {
      stopped = true;
      recognition.stop();
    },
  };
}

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}
if (typeof window !== "undefined") {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pickNaturalVoice();
  u.rate = 0.98;
  u.pitch = 1.05;
  window.speechSynthesis.speak(u);
}

// Prefer high-quality / neural voices that sound closer to human; fall back to any English voice.
function pickNaturalVoice(): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.startsWith("en"));
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
