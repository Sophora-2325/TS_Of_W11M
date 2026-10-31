export type OverlayMode = "freeze" | "live";

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlaySessionPayload {
  sessionId: string;
  mode: OverlayMode;
  bounds: MonitorBounds;
  scaleFactor: number;
  freezeFrame: string | null;
}

export interface DragRefs {
  selecting: boolean;
  start: unknown;
  pendingRect: unknown;
  rafId: number | null;
}

export interface OverlayUiState {
  sessionId: string | null;
  mode: OverlayMode | null;
  bounds: MonitorBounds | null;
  scaleFactor: number;
  freezeFrame: string | null;
  error: string | null;
  loading: boolean;
  imageGate: "idle" | "pending" | "loaded" | "failed" | "skipped";
  dragEpoch: number;
}

export type SessionAction =
  | { type: "none" }
  | { type: "ack-frontend" }
  | { type: "ack-frontend-and-load" }
  | { type: "ack-image-missing" }
  | { type: "ack-image-ok" }
  | { type: "ack-image-failed" };

export function emptyOverlayState(): OverlayUiState {
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

export function clearedDrag(): DragRefs {
  return { selecting: false, start: null, pendingRect: null, rafId: null };
}

export function decideSessionApply(
  activeSessionId: string | null,
  incomingSessionId: string,
): "apply" | "ignore" {
  if (!incomingSessionId) return "ignore";
  if (activeSessionId === null) return "apply";
  if (activeSessionId === incomingSessionId) return "ignore";
  const active = Number(activeSessionId);
  const incoming = Number(incomingSessionId);
  if (!Number.isSafeInteger(active) || !Number.isSafeInteger(incoming)) return "ignore";
  return incoming > active ? "apply" : "ignore";
}

export function isCurrentSession(
  activeSessionId: string | null,
  eventSessionId: string,
): boolean {
  return activeSessionId !== null && activeSessionId === eventSessionId;
}

export function readyRequirement(mode: OverlayMode): "image-decode" | "frontend-only" {
  return mode === "freeze" ? "image-decode" : "frontend-only";
}

function applyPayload(state: OverlayUiState, payload: OverlaySessionPayload): OverlayUiState {
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

export function onSessionPayload(
  state: OverlayUiState,
  payload: OverlaySessionPayload | null,
): { state: OverlayUiState; action: SessionAction } {
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

export function onImageDecoded(
  state: OverlayUiState,
  sessionId: string,
  ok: boolean,
): { state: OverlayUiState; action: SessionAction } {
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

export function onSessionHide(
  state: OverlayUiState,
  sessionId: string,
): { state: OverlayUiState; resetDrag: boolean } {
  if (!isCurrentSession(state.sessionId, sessionId)) {
    return { state, resetDrag: false };
  }
  return { state: { ...emptyOverlayState(), dragEpoch: state.dragEpoch + 1 }, resetDrag: true };
}

export function onSessionError(
  state: OverlayUiState,
  sessionId: string,
  message: string,
): OverlayUiState {
  if (!isCurrentSession(state.sessionId, sessionId)) return state;
  return {
    ...emptyOverlayState(),
    dragEpoch: state.dragEpoch + 1,
    error: message,
  };
}

export function onOcrSettled(
  state: OverlayUiState,
  sessionId: string,
  failedMessage: string | null,
): { state: OverlayUiState; apply: boolean } {
  if (!isCurrentSession(state.sessionId, sessionId)) {
    return { state, apply: false };
  }
  if (failedMessage) {
    return { state: { ...state, loading: false, error: failedMessage }, apply: true };
  }
  return { state: { ...state, loading: false, error: null }, apply: true };
}
