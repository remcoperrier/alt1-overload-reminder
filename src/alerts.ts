import * as a1lib from "alt1/base";

/** The Alt1 host injects a global `alt1` object; typed loosely on purpose. */
function alt1host(): any {
  return (globalThis as any).alt1;
}

let audioCtx: AudioContext | null = null;
let voicesReady: Promise<void> | null = null;

/** Chromium (which Alt1 embeds) only exposes OS voices asynchronously; the
 *  list is empty until the first `voiceschanged` event fires. Wait for that
 *  once, with a timeout, rather than speaking with zero voices loaded. */
function waitForVoices(synth: SpeechSynthesis): Promise<void> {
  if (synth.getVoices().length > 0) return Promise.resolve();
  voicesReady ??= new Promise((resolve) => {
    const done = () => resolve();
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 600);
  });
  return voicesReady;
}

/** Speaks "Jarno!" via the browser's built-in text-to-speech — no bundled
 *  audio file needed, so there's nothing to license or ship. Falls back to a
 *  synthesised beep if speech synthesis isn't available in this Alt1 build
 *  or has no voices installed. */
export async function playAlertSound(volume: number): Promise<void> {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (synth && typeof SpeechSynthesisUtterance !== "undefined") {
    try {
      await waitForVoices(synth);
      if (synth.getVoices().length > 0) {
        synth.cancel(); // don't queue up behind a previous alert
        const utter = new SpeechSynthesisUtterance("Jarno!");
        utter.volume = Math.max(0, Math.min(1, volume));
        utter.rate = 0.9;
        utter.pitch = 1.1;
        synth.speak(utter);
        return;
      }
    } catch {
      /* fall through to the beep */
    }
  }
  playBeep(volume);
}

/** Three sharp beeps synthesised with the Web Audio API — the fallback when
 *  speech synthesis isn't available. */
function playBeep(volume: number): void {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      const t0 = now + i * 0.26;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(Math.max(0.001, volume), t0 + 0.015);
      gain.gain.linearRampToValueAtTime(0, t0 + 0.19);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    }
  } catch {
    /* audio unavailable in this context */
  }
}

/** Flashes a coloured border around the RS client via Alt1's overlay API.
 *  [Overlay] permission required. */
export function flashOverlay(): void {
  const host = alt1host();
  if (!host?.permissionOverlay) return;
  const color = a1lib.mixColor(255, 60, 40);
  const pulses = 3;
  for (let i = 0; i < pulses; i++) {
    setTimeout(() => {
      try {
        host.overLayRect(color, host.rsX, host.rsY, host.rsWidth, host.rsHeight, 450, 8);
      } catch {
        /* overlay unavailable */
      }
    }, i * 500);
  }
}

/** Windows notification via Alt1 — also draws attention to the taskbar icon.
 *  [Overlay] permission required. */
export function showTaskbarAlert(message: string): void {
  const host = alt1host();
  if (!host?.permissionOverlay) return;
  try {
    host.showNotification("Overload Reminder", message, "");
  } catch {
    /* notification unavailable */
  }
}
