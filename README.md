# HT - Overload Reminder

An [Alt1](https://runeapps.org/alt1) plugin for RuneScape 3 that watches your buff bar
and warns you — with sound, a screen flash, and/or a taskbar alert — before your
Overload buff runs out.

## How it works

Rather than shipping a static reference image of the Overload buff icon (which would
break with different graphics settings, UI scale, or if the game's assets change), the
plugin **self-calibrates**: click **Calibrate** while Overload is active, pick its icon
out of your current buff bar, and the plugin remembers that exact icon (captured from
your own screen) to match against on every poll afterwards. Once found, it reads the
countdown text overlaid on the icon (Alt1's `alt1/buffs` OCR) and fires your chosen
alerts once the remaining time drops to your configured threshold.

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

- **Pixel** — to read the buff bar.
- **Overlay** — for the screen-flash alert and the taskbar notification.

## Setup in-game

1. Add the app to Alt1 via its `configUrl` (see `src/appconfig.json`).
2. Drink an Overload potion.
3. Open the panel, click **Calibrate**, and click the Overload icon in the row of
   candidates that appears.
4. Set your alert threshold and pick which alerts you want, then **Save**.
