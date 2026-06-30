import { useEffect, useState } from "react";
import {
  getEnglishVoices,
  getSelectedVoiceName,
  setSelectedVoiceName,
  onVoicesChanged,
  speak,
} from "../services/speech";

export function VoiceSelector() {
  const [voices, setVoices] = useState(getEnglishVoices());
  const [selected, setSelected] = useState(getSelectedVoiceName() ?? "");

  useEffect(() => onVoicesChanged(() => setVoices(getEnglishVoices())), []);

  if (voices.length === 0) return null;

  function onChange(name: string) {
    setSelected(name);
    setSelectedVoiceName(name || null);
    speak("Hi! This is how I sound.");
  }

  return (
    <label className="flex items-center gap-2 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
      <span>🔊 Voice</span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[#1d1d1f] outline-none backdrop-blur transition hover:bg-white focus:border-black/20 dark:border-white/15 dark:bg-white/10 dark:text-[#f5f5f7] dark:hover:bg-white/20 dark:focus:border-white/30"
      >
        <option value="" className="text-slate-900">
          Auto (recommended)
        </option>
        {voices.map((v) => (
          <option key={v.name} value={v.name} className="text-slate-900">
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
    </label>
  );
}
