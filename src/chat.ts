import * as a1lib from "alt1/base";
import * as ChatboxModule from "alt1/chatbox";

// `alt1/chatbox` is a CJS/UMD bundle with a compiled `export default`; under
// esbuild's Node-style interop the real class sits one level deeper.
type ChatBoxReaderCtor = typeof import("alt1/chatbox").default;
const chatboxMod = ChatboxModule as unknown as {
  default?: { default?: ChatBoxReaderCtor; defaultcolors?: number[][] } & ChatBoxReaderCtor;
  defaultcolors?: number[][];
};
const ChatBoxReader: ChatBoxReaderCtor =
  chatboxMod.default?.default ?? (chatboxMod.default as ChatBoxReaderCtor) ??
  (ChatboxModule as unknown as ChatBoxReaderCtor);
const defaultcolors: number[][] =
  chatboxMod.defaultcolors ?? chatboxMod.default?.defaultcolors ?? [];

// Alt1's default colour list leaves out the standard game-message red (it
// confuses broadcast detection in other plugins). The overload warning is that
// red, so add it for this reader.
const EXTRA_COLORS = [[239, 0, 0]];

/** "The effects of overload are about to wear off." (also matches elder overload). */
export function isOverloadWarning(text: string): boolean {
  const t = text.toLowerCase();
  return /overl[o0]ad/.test(t) && /(about\s*to|wear\s*off)/.test(t);
}

export type ChatState = "no-chatbox" | "unreadable" | "ok";

const MIN_REFIRE_MS = 15_000;

export class OverloadChatWatcher {
  private reader = new ChatBoxReader();
  private prevCount = 0;
  private baselined = false;
  private lastFire = 0;
  private readFailures = 0;
  private emptyReads = 0;

  constructor() {
    this.reader.readargs.colors = [...defaultcolors, ...EXTRA_COLORS].map((c) =>
      a1lib.mixColor(c[0], c[1], c[2]),
    );
    this.reader.diffReadUseTimestamps = false; // players may not have timestamps on
    this.reader.diffRead = false; // every visible line each poll; we de-dup by count
  }

  /** Returns the chat state and whether a *new* overload warning appeared. */
  poll(img: a1lib.ImgRef, log: (m: string) => void): { state: ChatState; fired: boolean } {
    if (!this.reader.pos) {
      this.reader.pos = (this.reader.find(img) as unknown as typeof this.reader.pos) ?? null;
      if (!this.reader.pos) return { state: "no-chatbox", fired: false };
      this.emptyReads = 0;
      log("chat box located");
    }

    const lines = this.reader.read(img);
    if (lines === null) {
      // A moved / resized chat invalidates the old position.
      if (++this.readFailures >= 4) {
        this.reader.pos = null;
        this.readFailures = 0;
      }
      return { state: "no-chatbox", fired: false };
    }
    this.readFailures = 0;

    if (lines.length === 0) {
      this.emptyReads++;
      return { state: this.emptyReads > 40 ? "unreadable" : "ok", fired: false };
    }
    this.emptyReads = 0;

    const count = lines.filter((l) => isOverloadWarning(l.text ?? "")).length;
    if (count > 0) log(`overload warning visible x${count}`);

    // The reader re-returns every visible line each poll, so only a rise in the
    // number of matching lines is a new warning. The first successful read just
    // sets the baseline so an old warning still on screen doesn't fire at startup.
    let fired = false;
    if (this.baselined && count > this.prevCount && Date.now() - this.lastFire > MIN_REFIRE_MS) {
      fired = true;
      this.lastFire = Date.now();
    }
    this.prevCount = count;
    this.baselined = true;
    return { state: "ok", fired };
  }
}
