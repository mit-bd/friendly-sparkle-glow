import { useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSpeechRecognition, VOICE_LANGS, type VoiceLang } from "@/lib/voice";

interface VoiceButtonProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Show a small language switch next to the mic. */
  showLang?: boolean;
  className?: string;
  size?: "icon" | "sm";
  /** Disable while a parse is already running. */
  busy?: boolean;
}

/**
 * Microphone capture button (Web Speech API). Supports Bangla & English; the raw
 * transcript is handed to the AI parser which also understands mixed "Banglish".
 */
export function VoiceButton({
  onResult,
  onInterim,
  showLang = true,
  className,
  size = "icon",
  busy,
}: VoiceButtonProps) {
  const [lang, setLang] = useState<VoiceLang>("bn-BD");
  const { state, listening, processing, error, start, stop, supported } = useSpeechRecognition({
    lang,
    onResult,
    onInterim,
  });

  if (!supported) return null;

  function toggle() {
    if (error) toast.error(error);
    if (listening || processing) stop();
    else start();
  }

  const langShort = VOICE_LANGS.find((l) => l.value === lang)?.short ?? "বাংলা";
  const active = listening || processing;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        size={size === "icon" ? "icon" : "sm"}
        variant={active ? "default" : "outline"}
        onClick={toggle}
        disabled={busy && !active}
        aria-label={active ? "Stop voice input" : "Start voice input"}
        title={
          state === "listening"
            ? "Listening… speak now"
            : state === "processing"
              ? "Processing…"
              : "Start voice input"
        }
        className={cn(active && "bg-brand-gradient text-brand-foreground", size === "icon" && "h-8 w-8")}
      >
        {busy || processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : listening ? (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-foreground/60" />
            <Mic className="relative h-4 w-4" />
          </span>
        ) : (
          <MicOff className="h-4 w-4" />
        )}
      </Button>
      {showLang && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
              {langShort}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {VOICE_LANGS.map((l) => (
              <DropdownMenuItem key={l.value} onClick={() => setLang(l.value)}>
                {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}