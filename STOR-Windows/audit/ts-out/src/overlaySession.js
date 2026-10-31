"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyOverlayState = emptyOverlayState;
exports.clearedDrag = clearedDrag;
exports.decideSessionApply = decideSessionApply;
exports.isCurrentSession = isCurrentSession;
exports.readyRequirement = readyRequirement;
exports.onSessionPayload = onSessionPayload;
exports.onImageDecoded = onImageDecoded;
exports.onSessionHide = onSessionHide;
exports.onSessionError = onSessionError;
exports.onOcrSettled = onOcrSettled;
function emptyOverlayState() {
    return {
        sessionId: null,
        mode: null,
        bounds: null,
        scaleFactor: 1,
        freezeFrame: null,
        error: null,
        loading: false,
        imageGate: "idle",
        dragEpoch: 0,
    };
}
function clearedDrag() {
    return { selecting: false, start: null, pendingRect: null, rafId: null };
}
function decideSessionApply(activeSessionId, incomingSessionId) {
    if (!incomingSessionId)
        return "ignore";
    if (activeSessionId === null)
        return "apply";
    if (activeSessionId === incomingSessionId)
        return "ignore";
    const active = Number(activeSessionId);
    const incoming = Number(incomingSessionId);
    if (!Number.isSafeInteger(active) || !Number.isSafeInteger(incoming))
        return "ignore";
    return incoming > active ? "apply" : "ignore";
}
function isCurrentSession(activeSessionId, eventSessionId) {
    return activeSessionId !== null && activeSessionId === eventSessionId;
}
function readyRequirement(mode) {
    return mode === "freeze" ? "image-decode" : "frontend-only";
}
function applyPayload(state, payload) {
    return {
        sessionId: payload.sessionId,
        mode: payload.mode,
        bounds: payload.bounds,
        scaleFactor: payload.scaleFactor,
        freezeFrame: payload.mode === "freeze" ? payload.freezeFrame : null,
        error: null,
        loading: false,
        imageGate: payload.mode === "freeze" ? "pending" : "skipped",
        dragEpoch: state.dragEpoch + 1,
    };
}
function onSessionPayload(state, payload) {
    if (!payload || decideSessionApply(state.sessionId, payload.sessionId) === "ignore") {
        return { state, action: { type: "none" } };
    }
    const next = applyPayload(state, payload);
    if (payload.mode === "live") {
        return { state: next, action: { type: "ack-frontend" } };
    }
    if (!payload.freezeFrame) {
        return {
            state: { ...next, imageGate: "failed", error: "底图缺失" },
            action: { type: "ack-image-missing" },
        };
    }
    return { state: next, action: { type: "ack-frontend-and-load" } };
}
function onImageDecoded(state, sessionId, ok) {
    if (!isCurrentSession(state.sessionId, sessionId) || state.mode !== "freeze") {
        return { state, action: { type: "none" } };
    }
    if (state.imageGate === "loaded" || state.imageGate === "failed") {
        return { state, action: { type: "none" } };
    }
    if (ok) {
        return {
            state: { ...state, imageGate: "loaded", error: null },
            action: { type: "ack-image-ok" },
        };
    }
    return {
        state: { ...state, imageGate: "failed", freezeFrame: null, error: "底图加载失败" },
        action: { type: "ack-image-failed" },
    };
}
function onSessionHide(state, sessionId) {
    if (!isCurrentSession(state.sessionId, sessionId)) {
        return { state, resetDrag: false };
    }
    return { state: { ...emptyOverlayState(), dragEpoch: state.dragEpoch + 1 }, resetDrag: true };
}
function onSessionError(state, sessionId, message) {
    if (!isCurrentSession(state.sessionId, sessionId))
        return state;
    return {
        ...emptyOverlayState(),
        dragEpoch: state.dragEpoch + 1,
        error: message,
    };
}
function onOcrSettled(state, sessionId, failedMessage) {
    if (!isCurrentSession(state.sessionId, sessionId)) {
        return { state, apply: false };
    }
    if (failedMessage) {
        return { state: { ...state, loading: false, error: failedMessage }, apply: true };
    }
    return { state: { ...state, loading: false, error: null }, apply: true };
}
