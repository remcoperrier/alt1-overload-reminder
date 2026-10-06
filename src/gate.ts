/** Decides when a count of on-screen warning lines means "a new warning arrived".
 *
 *  The chatbox reader re-OCRs every visible row on every poll, so a row can drop
 *  out for a poll or two (chat bumping up, busy scene behind it) and reappear, or
 *  briefly read twice. Counting a rise as "new" double-fires on that. */

/** A real second warning can't come sooner than a fresh potion's duration (~5 min)
 *  minus the ~20s warning, so anything inside this window is the same warning. */
export const REFIRE_MS = 120_000;
/** A lower count must hold this long before it's believed (otherwise it's a dropout). */
export const SETTLE_MS = 8_000;
/** A higher count must hold for this many consecutive polls (a single bad frame isn't a warning). */
export const CONFIRM_POLLS = 2;

export class WarningGate {
  /** Why the last update did or didn't fire — for debug logging only. */
  reason = "";

  private baselined = false;
  /** Most warning lines seen on screen at once that we've already accounted for. */
  private peak = 0;
  private lowerSince: number | null = null;
  private streak = 0;
  private lastFire = -Infinity;

  /** `count` = warning lines visible this poll, `now` in ms. Returns true to alert. */
  update(count: number, now: number): boolean {
    if (!this.baselined) {
      // An old warning still on screen at startup must not fire.
      this.baselined = true;
      this.peak = count;
      this.reason = `baseline ${count}`;
      return false;
    }

    if (count < this.peak) {
      this.streak = 0;
      this.lowerSince ??= now;
      if (now - this.lowerSince >= SETTLE_MS) {
        this.peak = count;
        this.lowerSince = null;
        this.reason = `settled to ${count}`;
      } else {
        this.reason = `dropout ${count}<${this.peak}`;
      }
      return false;
    }
    this.lowerSince = null;

    if (count === this.peak) {
      this.streak = 0;
      this.reason = "";
      return false;
    }

    if (++this.streak < CONFIRM_POLLS) {
      this.reason = `confirming ${count}>${this.peak}`;
      return false;
    }
    this.peak = count;
    this.streak = 0;

    const since = now - this.lastFire;
    if (since < REFIRE_MS) {
      this.reason = `suppressed: ${Math.round(since / 1000)}s since last alert`;
      return false;
    }
    this.lastFire = now;
    this.reason = `fire count=${count}`;
    return true;
  }
}
