# HT - Overload Reminder

An [Alt1](https://runeapps.org/alt1) plugin for RuneScape 3 that watches your chat box
and warns you — with sound, a screen flash, and/or a taskbar alert — before your
Overload buff runs out.

## How it works

RS3 prints **"The effects of overload are about to wear off."** in chat roughly 20 seconds
before Overload ends. The plugin reads your chat box with Alt1's chatbox OCR and fires
your chosen alerts (sound, screen flash, taskbar notification) when that line appears.
Keep chat text at the default size, or Alt1 can't read it.

The sound alert speaks **"Jarno!"** aloud using the browser's built-in text-to-speech
(no bundled audio file, nothing to license) with a volume you control. If speech
synthesis isn't available in your Alt1 build, it falls back to a synthesised beep.

### Optional: buff bar timer (Advanced)

If you'd rather pick exactly when to be warned, tick **Use the buff bar countdown
instead of the chat warning**. The plugin then self-calibrates: click **Calibrate** while
Overload is active, pick its icon out of your buff bar, and it matches that icon (from
your own screen) on every poll and reads the countdown text with Alt1's `alt1/buffs`.
This mode needs the buff bar setup below.

## Development

```bash
npm install
npm run dev
```

This starts a local dev server and prints an `alt1://addapp/...` link — open it (or
paste the URL into Alt1's "add app" screen) to load the app into Alt1 pointed at your
local build. `npm run build` produces a static `dist/` you can host anywhere (this repo
deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml` on every push to
`main`). `npm run typecheck` runs TypeScript with no emit.

## Permissions

- **Pixel** — to read the chat box (and buff bar).
- **Overlay** — for the screen-flash alert and the taskbar notification.

## Setup in-game

1. Add the app to Alt1 via its `configUrl` (see `src/appconfig.json`).
2. Leave chat text at the default size, pick which alerts you want, then **Save**.
   Use **Test** to check them.

### Buff bar mode only

1. In RS3, set **Buff Bar Size** to **Small** and both **Game Scale** and **UI Scale**
   to **100%** (Settings › Display). Alt1's `BuffReader` reads a hard-coded 27px icon
   on a 30px grid, so it silently can't find the buff bar at any other size or scale.
2. Drink an Overload potion, open Advanced, click **Calibrate**, and click the Overload
   icon in the row of candidates.
3. Set your alert threshold and **Save**.
