import { useRef, useState } from "react";

// Pick a recording MIME type the current browser actually supports.
// Chrome/Firefox → webm; Safari/iOS → mp4. Returning the type + file extension
// lets the server hand Gemini the correct mimeType.
function pickMimeType(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "mp4" },
    { mimeType: "audio/aac", ext: "aac" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  const supported =
    typeof MediaRecorder !== "undefined" && !!MediaRecorder.isTypeSupported;
  for (const c of candidates) {
    if (!supported || MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "", ext: "webm" }; // let the browser choose its default
}

// Construct a MediaRecorder that actually works on this browser. iOS Safari
// throws "The string did not match the expected pattern" (a SyntaxError) from
// the constructor for mimeTypes that isTypeSupported() wrongly reports as OK,
// so we try the chosen type first and progressively fall back to the browser
// default. Returns the recorder plus the file extension that matches it.
function createRecorder(
  stream: MediaStream,
  picked: { mimeType: string; ext: string }
): { recorder: MediaRecorder; ext: string } {
  const attempts: { mimeType?: string; ext: string }[] = [];
  if (picked.mimeType) attempts.push({ mimeType: picked.mimeType, ext: picked.ext });
  // iOS records to mp4; make it the next preference before the bare default.
  attempts.push({ mimeType: "audio/mp4", ext: "mp4" });
  attempts.push({ ext: picked.ext }); // no mimeType — let the browser decide
  for (const a of attempts) {
    try {
      const recorder = a.mimeType
        ? new MediaRecorder(stream, { mimeType: a.mimeType })
        : new MediaRecorder(stream);
      return { recorder, ext: a.ext };
    } catch {
      /* try the next fallback */
    }
  }
  // Last resort: bare constructor (may still throw, caught by caller).
  return { recorder: new MediaRecorder(stream), ext: picked.ext };
}

// Reject clips that are almost certainly unusable (mic muted / tapped by accident).
const MIN_SECONDS = 2;

export interface Recording {
  blob: Blob;
  mimeType: string;
  ext: string;
  seconds: number;
}

// Records microphone audio — cross-browser (Chrome, Firefox, Safari, iOS).
export function useAudioRecorder() {
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 live mic loudness, for a meter
  const [error, setError] = useState("");

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((r: Recording | null) => void) | null>(null);
  const mimeRef = useRef<{ mimeType: string; ext: string }>({ mimeType: "", ext: "webm" });
  const secondsRef = useRef(0);

  // Web Audio analyser plumbing for the level meter.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  function teardownMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }

  function startMeter(stream: MediaStream) {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Smooth and lightly boost so quiet speech still moves the meter.
        setLevel((prev) => prev * 0.6 + Math.min(1, rms * 2.2) * 0.4);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter is non-essential; ignore */
    }
  }

  async function start() {
    setError("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const picked = pickMimeType();
      // Build a recorder that works on this browser, with iOS-safe fallbacks.
      // The returned ext reflects whatever mimeType actually succeeded.
      const { recorder: mr, ext } = createRecorder(stream, picked);
      mimeRef.current = { mimeType: mr.mimeType || picked.mimeType, ext };
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        teardownMeter();
        const type = mr.mimeType || picked.mimeType || "audio/webm";
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type })
          : null;
        resolveRef.current?.(
          blob
            ? { blob, mimeType: type, ext, seconds: secondsRef.current }
            : null
        );
      };
      recRef.current = mr;
      // iOS Safari fires ondataavailable AFTER onstop when no timeslice is used,
      // so chunks are empty when onstop assembles the blob. Using a timeslice
      // forces incremental delivery and guarantees data is ready at stop.
      // Some iOS versions reject the timeslice arg, so fall back to a bare start.
      try {
        mr.start(250);
      } catch {
        mr.start();
      }
      startMeter(stream);
      setListening(true);
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch (e) {
      if (typeof MediaRecorder === "undefined") {
        setError("Your browser doesn't support audio recording. Try Chrome or Safari 14.3+.");
      } else {
        setError("Microphone access denied. Allow mic permission and try again.");
      }
    }
  }

  function stop(): Promise<Recording | null> {
    return new Promise((resolve) => {
      if (!recRef.current) return resolve(null);
      resolveRef.current = resolve;
      try {
        recRef.current.stop();
      } catch {
        // MediaRecorder.stop() can throw on some iOS versions; surface as null
        // so the caller shows "No audio captured" rather than a cryptic DOM error.
        resolveRef.current = null;
        resolve(null);
        return;
      }
      setListening(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    });
  }

  // Cancel a take without scoring it (discard / re-record).
  function cancel() {
    resolveRef.current = null;
    const mr = recRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = () => {};
      mr.stream?.getTracks().forEach((t) => t.stop());
      try {
        mr.stop();
      } catch {
        /* already stopped */
      }
    }
    chunksRef.current = [];
    teardownMeter();
    setListening(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    setSeconds(0);
    secondsRef.current = 0;
  }

  return {
    listening,
    seconds,
    level,
    error,
    minSeconds: MIN_SECONDS,
    start,
    stop,
    cancel,
  };
}
