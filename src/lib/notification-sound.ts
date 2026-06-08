/**
 * Subtle built-in notification chime — generated with the Web Audio API so no
 * audio asset needs to be bundled or downloaded. Plays a soft two-note rise.
 *
 * The chime is deliberately short and quiet to suit a professional finance
 * application. It only plays for genuinely new notifications (see
 * NotificationListener) — never when the user simply opens the list.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Play the subtle chime. Safe to call from any client event handler. */
export function playNotificationChime(): void {
  const audio = getContext();
  if (!audio) return;
  try {
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.connect(audio.destination);

    // Two gentle notes (C6 -> E6) for a pleasant, unobtrusive cue.
    const notes = [
      { freq: 1046.5, start: 0, dur: 0.18 },
      { freq: 1318.5, start: 0.12, dur: 0.22 },
    ];
    for (const note of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.12, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }
    master.gain.setValueAtTime(0.5, now);
  } catch {
    /* audio playback must never break the app */
  }
}