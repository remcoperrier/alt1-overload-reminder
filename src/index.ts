import * as a1lib from "alt1/base";
import * as BuffsModule from "alt1/buffs";

// `alt1/buffs` ships as a CJS/UMD bundle with a compiled `export default`.
// Under esbuild's Node-style interop the default import resolves to the
// whole `module.exports`, so the real class sits one level deeper — same
// issue as `alt1/chatbox`. Resolve it with fallbacks either way.
type BuffReaderCtor = typeof import("alt1/buffs").default;
const buffsMod = BuffsModule as unknown as {
  default?: { default?: BuffReaderCtor } & BuffReaderCtor;
};
const BuffReader: BuffReaderCtor =
  buffsMod.default?.default ?? (buffsMod.default as BuffReaderCtor) ??
  (BuffsModule as unknown as BuffReaderCtor);

/** Loosely typed handle for a single detected buff-bar icon. */
interface BuffHandle {
  buffer: ImageData;
  bufferx: number;
  buffery: number;
  compareBuffer(img: ImageData): boolean;
  readTime(): number;
}

import { loadSettings, saveSettings, type Settings } from "./settings";
import { cropImageData, imageDataToDataUrl, dataUrlToImageData } from "./template";
import { playAlertSound, flashOverlay, showTaskbarAlert } from "./alerts";

// --- Alt1 wiring -------------------------------------------------------------

a1lib.identifyApp("./appconfig.json");

/** The Alt1 host injects a global `alt1` object; typed loosely on purpose. */
const alt1host = (): any => (globalThis as any).alt1;

const buffReader = new BuffReader();
buffReader.debuffs = false; // Overload is a buff, not a debuff

// The icon content is cropped at the same +1,+1 offset Buff.compareBuffer
// uses internally, so a template captured from any bar slot lines up
// against a candidate found in any other slot later on.
const TEMPLATE_SIZE = 25;

// --- Settings + UI -----------------------------------------------------

let settings: Settings = loadSettings();
let template: ImageData | null = null;

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const thresholdEl = el<HTMLInputElement>("threshold");
const soundEl = el<HTMLInputElement>("a-sound");
const overlayEl = el<HTMLInputElement>("a-overlay");
const taskbarEl = el<HTMLInputElement>("a-taskbar");
const volumeEl = el<HTMLInputElement>("volume");
const calibrateBtn = el<HTMLButtonElement>("calibrate");
const calibrateRow = el<HTMLDivElement>("calibrate-row");
const candidatesEl = el<HTMLDivElement>("candidates");
const templatePreview = el<HTMLCanvasElement>("template-preview");
const templateStateEl = el<HTMLSpanElement>("template-state");
const statusEl = el<HTMLDivElement>("status");
const statusTextEl = el<HTMLSpanElement>("status-text");
const timerEl = el<HTMLDivElement>("timer");

const DEBUG = new URLSearchParams(location.search).has("debug") || !!settings.debugLog;

function dlog(msg: string): void {
  if (DEBUG) console.log("[overload-reminder] " + msg);
}

thresholdEl.value = String(settings.thresholdSeconds);
soundEl.checked = settings.alerts.sound;
overlayEl.checked = settings.alerts.overlay;
taskbarEl.checked = settings.alerts.taskbar;
volumeEl.value = String(Math.round(settings.soundVolume * 100));

type Level = "" | "ok" | "warn" | "err";

function setStatus(msg: string, level: Level = ""): void {
  statusTextEl.textContent = msg;
  statusEl.className = "status" + (level ? " " + level : "");
}

function drawPreview(img: ImageData): void {
  templatePreview.width = img.width;
  templatePreview.height = img.height;
  templatePreview.getContext("2d")!.putImageData(img, 0, 0);
  templatePreview.classList.remove("hidden");
}

function renderTemplateState(): void {
  if (template) {
    drawPreview(template);
    templateStateEl.textContent = "Calibrated";
    templateStateEl.className = "ok";
  } else {
    templatePreview.classList.add("hidden");
    templateStateEl.textContent = "Not calibrated";
    templateStateEl.className = "warn";
  }
}

if (settings.template) {
  dataUrlToImageData(settings.template.dataUrl)
    .then((img) => {
      template = img;
      renderTemplateState();
    })
    .catch(() => {
      dlog("stored template failed to decode");
    });
}
renderTemplateState();

// --- Save --------------------------------------------------------------

el<HTMLButtonElement>("save").addEventListener("click", () => {
  const threshold = Math.min(600, Math.max(5, parseInt(thresholdEl.value, 10) || 30));
  settings = {
    ...settings,
    thresholdSeconds: threshold,
    alerts: {
      sound: soundEl.checked,
      overlay: overlayEl.checked,
      taskbar: taskbarEl.checked,
    },
    soundVolume: Math.min(100, Math.max(0, parseInt(volumeEl.value, 10) || 0)) / 100,
  };
  thresholdEl.value = String(threshold);
  saveSettings(settings);
  setStatus("Settings saved.", "ok");
});

el<HTMLButtonElement>("test").addEventListener("click", () => {
  fireAlerts("Test alert — this is what you'll see/hear when Overload is about to run out.");
});

// --- Calibration ---------------------------------------------------------

function clearCandidates(): void {
  candidatesEl.innerHTML = "";
  calibrateRow.classList.add("hidden");
}

calibrateBtn.addEventListener("click", () => {
  const host = alt1host();
  if (!host) {
    setStatus("Open this page inside Alt1 to calibrate.", "warn");
    return;
  }
  let img: a1lib.ImgRef;
  try {
    img = a1lib.captureHoldFullRs();
  } catch {
    setStatus("Can't capture the RuneScape client — is the game running?", "warn");
    return;
  }

  if (!buffReader.pos) buffReader.find(img);
  if (!buffReader.pos) {
    setStatus("Couldn't find your buff bar. Make sure at least one buff or debuff icon is visible, then try again.", "warn");
    return;
  }

  const buffs = (buffReader.read() ?? []) as unknown as BuffHandle[];
  if (buffs.length === 0) {
    setStatus("No active buffs found. Drink your Overload potion, then click Calibrate.", "warn");
    clearCandidates();
    return;
  }

  candidatesEl.innerHTML = "";
  for (const b of buffs) {
    const crop = cropImageData(b.buffer, b.bufferx + 1, b.buffery + 1, TEMPLATE_SIZE, TEMPLATE_SIZE);
    const canvas = document.createElement("canvas");
    canvas.width = TEMPLATE_SIZE;
    canvas.height = TEMPLATE_SIZE;
    canvas.className = "candidate";
    canvas.title = "Click if this is your Overload icon";
    canvas.getContext("2d")!.putImageData(crop, 0, 0);
    canvas.addEventListener("click", () => {
      template = crop;
      settings = { ...settings, template: { dataUrl: imageDataToDataUrl(crop), width: TEMPLATE_SIZE, height: TEMPLATE_SIZE } };
      saveSettings(settings);
      renderTemplateState();
      clearCandidates();
      setStatus("Calibrated — watching for Overload.", "ok");
      wasActive = false;
      alerted = false;
    });
    candidatesEl.appendChild(canvas);
  }
  calibrateRow.classList.remove("hidden");
  setStatus("Click the icon that is your Overload buff below.", "warn");
});

// --- Alerts --------------------------------------------------------------

function fireAlerts(message: string): void {
  if (settings.alerts.sound) playAlertSound(settings.soundVolume);
  if (settings.alerts.overlay) flashOverlay();
  if (settings.alerts.taskbar) showTaskbarAlert(message);
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// --- Poll loop -----------------------------------------------------------

let wasActive = false;
let alerted = false;

function tick(): void {
  const host = alt1host();
  if (!host) {
    setStatus("Open this page inside Alt1 to use it.", "warn");
    return;
  }
  if (!host.permissionPixel) {
    setStatus("Alt1 is missing the 'pixel' permission for this app.", "err");
    return;
  }

  let img: a1lib.ImgRef;
  try {
    img = a1lib.captureHoldFullRs();
  } catch {
    setStatus("Can't capture the RuneScape client — is the game running?", "warn");
    return;
  }

  if (!buffReader.pos) {
    buffReader.find(img);
    if (!buffReader.pos) {
      setStatus("Looking for your buff bar…", "warn");
      timerEl.classList.add("hidden");
      return;
    }
    dlog("buff bar located");
  }

  const buffs = buffReader.read() as unknown as BuffHandle[] | null;
  if (buffs === null) {
    buffReader.pos = null;
    setStatus("Buff bar moved — relocating…", "warn");
    timerEl.classList.add("hidden");
    return;
  }

  if (!template) {
    setStatus("Not calibrated — drink Overload, then click Calibrate below.", "warn");
    timerEl.classList.add("hidden");
    return;
  }

  let match: BuffHandle | null = null;
  for (const b of buffs) {
    if (b.compareBuffer(template)) {
      match = b;
      break;
    }
  }

  if (!match) {
    if (wasActive) dlog("Overload no longer active");
    wasActive = false;
    alerted = false;
    setStatus(buffs.length ? "Watching — Overload not currently active." : "Watching — no buffs active.", "ok");
    timerEl.classList.add("hidden");
    return;
  }

  wasActive = true;
  const remaining = match.readTime();
  if (remaining <= 0) {
    // OCR miss on this poll; keep previous alert state, try again next tick.
    setStatus("Overload active — reading timer…", "ok");
    return;
  }

  timerEl.textContent = `Overload: ${formatTime(remaining)} remaining`;
  timerEl.classList.remove("hidden");

  if (remaining <= settings.thresholdSeconds) {
    setStatus("Overload is about to run out!", "warn");
    if (!alerted) {
      dlog(`alerting at ${remaining}s remaining`);
      fireAlerts(`Your Overload runs out in ${formatTime(remaining)}.`);
      alerted = true;
    }
  } else {
    setStatus("Watching your Overload buff.", "ok");
    alerted = false;
  }
}

setInterval(tick, 1000);
dlog("started");
