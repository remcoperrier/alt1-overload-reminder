export interface BuffTemplate {
  /** PNG data URL of the calibrated Overload icon crop. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface Settings {
  /** Alert once remaining time drops to or below this many seconds. */
  thresholdSeconds: number;
  /** Which alert channels are enabled. */
  alerts: {
    sound: boolean;
    overlay: boolean;
    taskbar: boolean;
  };
  /** 0-1 */
  soundVolume: number;
  /** Calibrated reference icon used to pick Overload out of the buff bar. */
  template: BuffTemplate | null;
  /** Log buff-bar reads to the console (diagnostics). */
  debugLog: boolean;
}

const KEY = "overload-reminder:settings";

const DEFAULTS: Settings = {
  thresholdSeconds: 30,
  alerts: {
    sound: true,
    overlay: true,
    taskbar: false,
  },
  soundVolume: 0.6,
  template: null,
  debugLog: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        ...DEFAULTS,
        ...parsed,
        alerts: { ...DEFAULTS.alerts, ...(parsed.alerts ?? {}) },
        template: parsed.template ?? null,
      };
    }
  } catch {
    /* corrupt / unavailable storage -> fall through to defaults */
  }
  return { ...DEFAULTS, alerts: { ...DEFAULTS.alerts } };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable -> settings simply won't persist */
  }
}
