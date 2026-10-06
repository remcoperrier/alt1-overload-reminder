import { WarningGate } from "../src/gate.ts";

// Poll sequences are [count, seconds] runs, one poll per second (like the plugin).
function run(runs) {
  const g = new WarningGate();
  const fires = [];
  let t = 0;
  for (const [count, secs] of runs) {
    for (let i = 0; i < secs; i++, t++) if (g.update(count, t * 1000)) fires.push(t);
  }
  return fires;
}

// The behaviour before the fix: fire on any count rise, 15s guard.
function oldRun(runs) {
  let prev = 0, base = false, last = -Infinity, t = 0;
  const fires = [];
  for (const [count, secs] of runs) {
    for (let i = 0; i < secs; i++, t++) {
      if (base && count > prev && t * 1000 - last > 15_000) { fires.push(t); last = t * 1000; }
      prev = count; base = true;
    }
  }
  return fires;
}

let failed = 0;
function expect(name, runs, want, oldWant) {
  const got = run(runs);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  const old = oldWant ? `  (old logic: ${JSON.stringify(oldRun(runs))})` : "";
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: fires at ${JSON.stringify(got)}${ok ? "" : ` want ${JSON.stringify(want)}`}${old}`);
}

expect("old warning on screen at startup", [[1, 60]], []);
expect("normal warning", [[0, 10], [1, 60]], [11], true);
expect("dropout 25s after warning (chat bump)", [[0, 5], [1, 25], [0, 2], [1, 30]], [6], true);
expect("dropout 200s after warning", [[0, 5], [1, 200], [0, 2], [1, 30]], [6], true);
expect("one-poll duplicate read at 25s", [[0, 5], [1, 25], [2, 1], [1, 30]], [6], true);
expect("one-poll duplicate read at 200s", [[0, 5], [1, 200], [2, 1], [1, 30]], [6], true);
expect("single bad frame, no warning", [[0, 5], [1, 1], [0, 30]], []);
expect("dropout shorter than settle, repeated", [[0, 5], [1, 20], [0, 3], [1, 20], [0, 4], [1, 20]], [6], true);
expect("real 2nd warning, old line scrolled off", [[0, 5], [1, 10], [0, 300], [1, 30]], [6, 316], true);
expect("real 2nd warning, old line still visible", [[0, 5], [1, 300], [2, 30]], [6, 306], true);
expect("persistent duplicate inside 120s, then real 2nd warning", [[0, 5], [1, 10], [2, 20], [1, 300], [2, 30]], [6, 336]);
expect("scroll-off then new line 100s later is the same episode", [[0, 5], [1, 10], [0, 80], [1, 30]], [6]);

console.log(failed ? `\n${failed} scenario(s) failed` : "\nall scenarios passed");
process.exit(failed ? 1 : 0);
