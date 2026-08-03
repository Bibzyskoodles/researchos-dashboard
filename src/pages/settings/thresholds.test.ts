/**
 * Settings must send what they show, and say what the server said.
 *
 * The founder set the pass threshold to 30, saved, and watched it revert to 70.
 * The screen said only:
 *
 *   "Saved locally, but couldn't save to the server — the AI checks won't see
 *    this context until it's retried."
 *
 * Two defects produced that, and between them they cost an entire evening of
 * diagnosis and made several earlier conclusions wrong.
 *
 * FIRST — the flag slider renders a clamped value, Math.min(flag, pass - 5),
 * but the raw state was what got saved. With flag at 50 and pass moved to 30,
 * the screen showed 25 while the request carried 50. The server correctly
 * refused: flag_threshold must be lower than pass_threshold.
 *
 * SECOND — that refusal was thrown away unread. `.catch(() => setError(generic))`
 * discarded a precise, actionable message and replaced it with one that could
 * not help anyone.
 *
 * And because the request is atomic, the rejection took the image context, the
 * audio context, the research purpose and the zone settings down with it. That
 * is why the AI checks appeared to ignore every description written for them:
 * the descriptions had never reached the server at all.
 */

// This file has no imports, which makes it a global script under
// --isolatedModules and fails the production build even though jest runs it
// happily. Exactly the gap CLAUDE.md warns about: the test runner is not the
// build gate.
export {};

// The rule the server enforces, mirrored here so the UI can never send a
// combination it is guaranteed to reject.
const clampFlag = (flag: number, pass: number) => Math.min(flag, pass - 5);

// The error text the settings page produces from an axios failure. Extracted
// to the same shape as the component so it can be exercised without mounting
// the page.
function describeSaveError(err: any): string {
  const serverMessage = err?.response?.data?.error;
  if (typeof serverMessage === "string" && serverMessage) {
    return `Couldn't save to the server: ${serverMessage} — the AI checks won't see this context until it saves.`;
  }
  if (!err?.response) {
    return "Couldn't reach the server, so this is saved on this device only — the AI checks won't see it until it saves.";
  }
  return `Couldn't save to the server (error ${err.response.status}) — the AI checks won't see this context until it saves.`;
}

describe("threshold clamping", () => {
  it("sends a flag threshold below the pass threshold — the exact failing case", () => {
    // Pass moved to 30 while flag sat at 50. The server rejects flag >= pass.
    expect(clampFlag(50, 30)).toBeLessThan(30);
  });

  it("sends the value the slider displays, not the stale state behind it", () => {
    // The slider rendered Math.min(flag, pass - 5); the payload carried the raw
    // state. Showing one number and sending another is the bug itself.
    const pass = 30;
    const rawState = 50;
    const displayed = Math.min(rawState, pass - 5);
    expect(clampFlag(rawState, pass)).toBe(displayed);
  });

  it("leaves a valid combination untouched", () => {
    // Clamping must not quietly rewrite settings that were already fine.
    expect(clampFlag(50, 70)).toBe(50);
  });

  it("never produces flag >= pass across the whole slider range", () => {
    for (let pass = 30; pass <= 90; pass++) {
      for (let flag = 20; flag <= 90; flag++) {
        expect(clampFlag(flag, pass)).toBeLessThan(pass);
      }
    }
  });
});

describe("save error reporting", () => {
  it("repeats the server's own explanation", () => {
    // The real 400 that reverted the pass threshold to 70.
    const err = {
      response: {
        status: 400,
        data: { error: "flag_threshold must be lower than pass_threshold" },
      },
    };
    expect(describeSaveError(err)).toContain("flag_threshold must be lower than pass_threshold");
  });

  it("distinguishes unreachable from rejected", () => {
    // No response at all is a different problem with a different fix, and
    // telling someone to check their settings when the server is down wastes
    // exactly the time this whole change exists to save.
    const offline = describeSaveError({ message: "Network Error" });
    expect(offline).toContain("reach");
    expect(offline).not.toContain("error undefined");
  });

  it("still says something useful when the server gives no message", () => {
    const bare = describeSaveError({ response: { status: 500, data: {} } });
    expect(bare).toContain("500");
  });

  it("never claims the settings saved when they did not", () => {
    // The old text opened with "Saved locally", which reads as success. The
    // settings had not reached the engines, and the next screen the user looked
    // at was scored without them.
    const cases = [
      { response: { status: 400, data: { error: "flag_threshold must be lower than pass_threshold" } } },
      { response: { status: 500, data: {} } },
      { message: "Network Error" },
    ];
    for (const err of cases) {
      expect(describeSaveError(err).toLowerCase()).toContain("couldn't");
    }
  });
});

// These two functions mirror logic that lives inside SettingsPage. Mirrored
// logic can drift, and a test asserting on a copy would pass happily while the
// component still shipped the bug — so assert the component really contains
// both halves. Reading the source is crude, but the alternative is mounting a
// 3000-line settings page to observe one request payload.
describe("the component actually does this", () => {
  const fs = require("fs");
  const path = require("path");
  const src = fs.readFileSync(
    path.join(__dirname, "SettingsPage.tsx"),
    "utf8",
  );

  it("clamps the flag threshold before saving", () => {
    expect(src).toContain(
      "const effectiveFlagThreshold = Math.min(flagScoreThreshold, passScoreThreshold - 5)",
    );
  });

  it("sends the clamped value, not the raw state", () => {
    expect(src).toContain("flag_threshold: effectiveFlagThreshold");
    expect(src).not.toContain("flag_threshold: flagScoreThreshold");
  });

  it("reads the server's error instead of discarding it", () => {
    expect(src).toContain("err?.response?.data?.error");
    // The old handler took no argument at all — that signature is the defect.
    expect(src).not.toContain(".catch(() => setBackendSaveError(");
  });
});
