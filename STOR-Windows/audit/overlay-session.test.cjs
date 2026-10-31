const test = require("node:test");
const assert = require("node:assert/strict");
const session = require("./ts-out/src/overlaySession.js");

function payload(id, mode, frame) {
  return {
    sessionId: id,
    mode,
    bounds: { x: 0, y: 0, width: 100, height: 80 },
    scaleFactor: 1.5,
    freezeFrame: frame,
  };
}

test("late listener applies the pending session when nothing is active", () => {
  const decision = session.onSessionPayload(session.emptyOverlayState(), payload("4", "freeze", "frame-4"));
  assert.equal(decision.action.type, "ack-frontend-and-load");
  assert.equal(decision.state.sessionId, "4");
  assert.equal(decision.state.freezeFrame, "frame-4");
  assert.equal(decision.state.dragEpoch, 1);
});

test("duplicate and older events do not replace the current session", () => {
  const first = session.onSessionPayload(session.emptyOverlayState(), payload("2", "freeze", "new"));
  const duplicate = session.onSessionPayload(first.state, payload("2", "freeze", "again"));
  assert.equal(duplicate.action.type, "none");
  assert.equal(duplicate.state.freezeFrame, "new");
  assert.equal(duplicate.state.dragEpoch, 1);
  const stale = session.onSessionPayload(first.state, payload("1", "live", null));
  assert.equal(stale.action.type, "none");
  assert.equal(stale.state.sessionId, "2");
});

test("image decode failure clears the frame and a stale reply is ignored", () => {
  const current = session.onSessionPayload(session.emptyOverlayState(), payload("3", "freeze", "frame")).state;
  const failed = session.onImageDecoded(current, "3", false);
  assert.equal(failed.action.type, "ack-image-failed");
  assert.equal(failed.state.freezeFrame, null);
  assert.equal(failed.state.imageGate, "failed");
  const newer = session.onSessionPayload(failed.state, payload("4", "freeze", "next")).state;
  const late = session.onImageDecoded(newer, "3", true);
  assert.equal(late.action.type, "none");
  assert.equal(late.state.sessionId, "4");
  assert.equal(late.state.freezeFrame, "next");
});

test("hide, timeout, and ocr results from an old session do not reset the new one", () => {
  let state = session.onSessionPayload(session.emptyOverlayState(), payload("8", "live", null)).state;
  const hidden = session.onSessionHide(state, "7");
  assert.equal(hidden.resetDrag, false);
  assert.equal(hidden.state.sessionId, "8");
  const errored = session.onSessionError(state, "7", "截图准备超时");
  assert.equal(errored.sessionId, "8");
  const ocr = session.onOcrSettled(state, "7", "旧任务失败");
  assert.equal(ocr.apply, false);
  assert.equal(ocr.state.error, null);
  state = session.onSessionHide(state, "8").state;
  assert.equal(state.sessionId, null);
  assert.equal(session.clearedDrag().rafId, null);
});

test("live mode is ready without an image and a missing freeze frame fails closed", () => {
  assert.equal(session.readyRequirement("live"), "frontend-only");
  assert.equal(session.readyRequirement("freeze"), "image-decode");
  const live = session.onSessionPayload(session.emptyOverlayState(), payload("1", "live", null));
  assert.equal(live.action.type, "ack-frontend");
  assert.equal(live.state.imageGate, "skipped");
  const missing = session.onSessionPayload(session.emptyOverlayState(), payload("1", "freeze", null));
  assert.equal(missing.action.type, "ack-image-missing");
  assert.equal(missing.state.imageGate, "failed");
});
