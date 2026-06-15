import { useCallback, useEffect, useRef, useState } from "react";

/** Languages offered for the Web Speech API capture. */
export type VoiceLang = "bn-BD" | "en-US";

export const VOICE_LANGS: { value: VoiceLang; label: string; short: string }[] = [
  { value: "bn-BD", label: "Bangla / Banglish", short: "বাংলা" },
  { value: "en-US", label: "English", short: "EN" },
];

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
  onInterim?: (text: string) => void;
}

/**
 * Thin wrapper around the browser Web Speech API. Works on Chrome/Edge/Android
 * and (partially) iOS Safari. After capture, the raw transcript is sent to the
 * AI parser which normalises Bangla / English / Banglish into a transaction.
 */
export function useSpeechRecognition({ lang, onResult, onInterim }: UseSpeechOptions) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const cbRef = useRef({ onResult, onInterim });
  cbRef.current = { onResult, onInterim };

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    setError(null);
    const rec = getRecognition();
    if (!rec) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    finalRef.current = "";
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
      if (interim) cbRef.current.onInterim?.(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech") setError("No speech detected. Try again.");
      else if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Microphone access was blocked. Allow it in your browser settings.");
      else setError("Voice input failed. Please try again.");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text) cbRef.current.onResult(text);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start voice input.");
    }
  }, [lang]);

  useEffect(() => () => stop(), [stop]);

  return { listening, error, start, stop, supported: isSpeechSupported() };
}