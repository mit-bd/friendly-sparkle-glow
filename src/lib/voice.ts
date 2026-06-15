import { useCallback, useEffect, useRef, useState } from "react";

/** Languages offered for the Web Speech API capture. */
export type VoiceLang = "bn-BD" | "en-US";

export const VOICE_LANGS: { value: VoiceLang; label: string; short: string }[] = [
  { value: "bn-BD", label: "Bangla / Banglish", short: "বাংলা" },
  { value: "en-US", label: "English", short: "EN" },
];

/** Visual lifecycle of a dictation session. */
export type VoiceState = "idle" | "listening" | "processing" | "complete";

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

interface UseSpeechOptions {
  lang: VoiceLang;
  onResult: (finalText: string) => void;
  /** Live transcript (committed words + current interim), fired continuously while speaking. */
  onInterim?: (liveText: string) => void;
  /** Auto-stop after this many ms of silence. Default 2500ms. */
  silenceMs?: number;
}

/**
 * Live-dictation wrapper around the browser Web Speech API (Google-Keyboard
 * style). Works on Chrome/Edge/Android and (partially) iOS Safari. Emits a
 * continuously-updating transcript via `onInterim` while the user speaks and the
 * final, cleaned transcript via `onResult`. Auto-stops after a short silence.
 */
export function useSpeechRecognition({
  lang,
  onResult,
  onInterim,
  silenceMs = 2500,
}: UseSpeechOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef({ onResult, onInterim });
  cbRef.current = { onResult, onInterim };

  const clearSilence = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilence();
    setState((s) => (s === "listening" ? "processing" : s));
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, [clearSilence]);

  const armSilence = useCallback(() => {
    clearSilence();
    silenceTimer.current = setTimeout(() => stop(), silenceMs);
  }, [clearSilence, silenceMs, stop]);

  const start = useCallback(() => {
    setError(null);
    const rec = getRecognition();
    if (!rec) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    finalRef.current = "";
    if (completeTimer.current) clearTimeout(completeTimer.current);
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      const live = (finalRef.current + interim).replace(/\s+/g, " ").trim();
      cbRef.current.onInterim?.(live);
      // Reset the silence countdown every time fresh audio is recognised.
      armSilence();
    };
    rec.onerror = (e: any) => {
      if (e.error === "aborted") return; // normal on manual/silence stop
      if (e.error === "no-speech") setError("No speech detected. Try again.");
      else if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Microphone access was blocked. Allow it in your browser settings.");
      else setError("Voice input failed. Please try again.");
    };
    rec.onend = () => {
      clearSilence();
      const text = finalRef.current.replace(/\s+/g, " ").trim();
      setState("complete");
      if (text) cbRef.current.onResult(text);
      // Briefly show the "complete" state, then settle back to idle.
      completeTimer.current = setTimeout(() => setState("idle"), 1200);
    };

    recRef.current = rec;
    try {
      rec.start();
      setState("listening");
      armSilence();
    } catch {
      setError("Could not start voice input.");
      setState("idle");
    }
  }, [lang, armSilence, clearSilence]);

  useEffect(
    () => () => {
      clearSilence();
      if (completeTimer.current) clearTimeout(completeTimer.current);
      try {
        recRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    },
    [clearSilence],
  );

  return {
    state,
    listening: state === "listening",
    processing: state === "processing",
    error,
    start,
    stop,
    supported: isSpeechSupported(),
  };
}