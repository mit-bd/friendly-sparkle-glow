import { useRef, useState } from "react";
import { Mic, MicOff, Loader2, Check } from "lucide-react";
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

interface DictationButtonProps {
  /** The textarea/input being dictated into. */
  targetRef: React.RefObject<HTMLTextAreaElement>;
  /** Last known caret selection of the target (tracked by the parent). */
  selectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
  /** Current field value. */
  value: string;
  /** Called with the full field value after each live update. */
  onChange: (value: string) => void;
  /** Called once with the final dictated chunk (for downstream AI parsing). */
  onFinal?: (dictated: string) => void;
  /** Disable interactions while a parse is running. */
  busy?: boolean;
  className?: string;
}

/**
 * Google-Keyboard-style live dictation. The mic starts listening immediately and
 * inserts recognised speech into the target field in real time at the caret,
 * preserving any manually typed text. Interim words update continuously and are
 * replaced by the final transcript. Auto-stops after a short silence.
 */
export function DictationButton({
  targetRef,
  selectionRef,
  value,
  onChange,
  onFinal,
  busy,
  className,
}: DictationButtonProps) {
  const [lang, setLang] = useState<VoiceLang>("bn-BD");
  // Snapshot of the field around the caret, captured when dictation begins.
  const baseRef = useRef<{ before: string; after: string }>({ before: "", after: "" });
  const valueRef = useRef(value);
  valueRef.current = value;

  function insert(dictated: string) {
    const { before, after } = baseRef.current;
    const sep = before && !/\s$/.test(before) && dictated ? " " : "";
    const next = before + sep + dictated + after;
    onChange(next);
    const caret = (before + sep + dictated).length;
    requestAnimationFrame(() => {
      const el = targetRef.current;
      if (el) {
        try {
          el.focus();
          el.setSelectionRange(caret, caret);
        } catch {
          /* ignore */
        }
      }
    });
  }

  const { state, listening, processing, error, start, stop, supported } = useSpeechRecognition({
    lang,
    silenceMs: 2500,
    onInterim: (live) => insert(live),
    onResult: (finalText) => {
      insert(finalText);
      onFinal?.(finalText);
    },
  });

  if (!supported) return null;

  function toggle() {
    if (error) toast.error(error);
    if (listening || processing) {
      stop();
      return;
    }
    // Capture the caret so dictation is appended at the cursor, not the start.
    const v = valueRef.current;
    const sel = selectionRef.current;
    const start = sel ? Math.min(sel.start, v.length) : v.length;
    const end = sel ? Math.min(sel.end, v.length) : v.length;
    baseRef.current = { before: v.slice(0, start), after: v.slice(end) };
    startListening();
  }

  function startListening() {
    start();
  }

  const langShort = VOICE_LANGS.find((l) => l.value === lang)?.short ?? "বাংলা";
  const active = listening || processing;

  const statusLabel =
    state === "listening"
      ? "Listening…"
      : state === "processing"
        ? "Processing…"
        : state === "complete"
          ? "Done"
          : "Dictate";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "text-xs font-medium tabular-nums transition-colors",
          state === "listening" && "text-brand-to",
          state === "processing" && "text-muted-foreground",
          state === "complete" && "text-success",
          state === "idle" && "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {statusLabel}
      </span>
      <Button
        type="button"
        size="icon"
        variant={active ? "default" : "outline"}
        onClick={toggle}
        disabled={busy && !active}
        aria-label={active ? "Stop dictation" : "Start dictation"}
        title={statusLabel}
        className={cn("h-8 w-8", active && "bg-brand-gradient text-brand-foreground")}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : listening ? (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-foreground/60" />
            <Mic className="relative h-4 w-4" />
          </span>
        ) : state === "complete" ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={active}>
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
    </div>
  );
}