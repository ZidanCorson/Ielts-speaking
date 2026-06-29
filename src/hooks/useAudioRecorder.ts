import { useRef, useState } from "react";

// Records microphone audio to a webm Blob — works in all modern browsers.
export function useAudioRecorder() {
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);

  async function start() {
    setError("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: "audio/webm" })
          : null;
        resolveRef.current?.(blob);
      };
      recRef.current = mr;
      mr.start();
      setListening(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied. Allow mic permission and try again.");
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!recRef.current) return resolve(null);
      resolveRef.current = resolve;
      recRef.current.stop();
      setListening(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    });
  }

  return { listening, seconds, error, start, stop };
}
