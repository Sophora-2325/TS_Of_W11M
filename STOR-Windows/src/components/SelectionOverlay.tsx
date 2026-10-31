import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  type OverlaySessionPayload,
  type OverlayUiState,
  emptyOverlayState,
  onImageDecoded,
  onOcrSettled,
  onSessionHide,
  onSessionPayload,
} from "../overlaySession";

interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragStart {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

function normalizePayload(payload: OverlaySessionPayload): OverlaySessionPayload {
  if (!payload.freezeFrame || payload.freezeFrame.startsWith("data:")) return payload;
  return { ...payload, freezeFrame: `data:image/jpeg;base64,${payload.freezeFrame}` };
}

function decodeFreezeFrame(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(() => resolve()).catch(() => reject(new Error("底图解码失败")));
      } else {
        resolve();
      }
    };
    image.onerror = () => reject(new Error("底图加载失败"));
    image.src = src;
  });
}

export function SelectionOverlay() {
  const [ui, setUi] = useState<OverlayUiState>(emptyOverlayState);
  const [visualRect, setVisualRect] = useState<VisualRect | null>(null);
  const uiRef = useRef(ui);
  const sessionRef = useRef<string | null>(null);
  const monitorBoundsRef = useRef(ui.bounds);
  const startRef = useRef<DragStart | null>(null);
  const selectingRef = useRef(false);
  const scaleRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const pendingRectRef = useRef<VisualRect | null>(null);
  const loadEpochRef = useRef(0);

  const resetDrag = useCallback(() => {
    selectingRef.current = false;
    startRef.current = null;
    pendingRectRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setVisualRect(null);
  }, []);

  const commit = useCallback((next: OverlayUiState) => {
    if (next.dragEpoch !== uiRef.current.dragEpoch) {
      selectingRef.current = false;
      startRef.current = null;
      pendingRectRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setVisualRect(null);
    }
    uiRef.current = next;
    sessionRef.current = next.sessionId;
    monitorBoundsRef.current = next.bounds;
    scaleRef.current = next.scaleFactor;
    setUi(next);
  }, []);

  const acceptPayload = useCallback(async (payload: OverlaySessionPayload) => {
    const decision = onSessionPayload(uiRef.current, payload);
    if (decision.action.type === "none" || !decision.state.sessionId) return;
    const epoch = ++loadEpochRef.current;
    const sessionId = decision.state.sessionId;
    commit(decision.state);
    if (decision.action.type === "ack-image-missing") {
      await invoke("ack_overlay_image", { sessionId, ok: false, message: "底图缺失" });
      return;
    }
    if (decision.action.type === "ack-frontend" || decision.action.type === "ack-frontend-and-load") {
      await invoke("ack_overlay_frontend", { sessionId });
    }
    if (loadEpochRef.current !== epoch || uiRef.current.sessionId !== sessionId) return;
    if (decision.action.type !== "ack-frontend-and-load" || !decision.state.freezeFrame) return;
    try {
      await decodeFreezeFrame(decision.state.freezeFrame);
      if (loadEpochRef.current !== epoch || uiRef.current.sessionId !== sessionId) return;
      const decoded = onImageDecoded(uiRef.current, sessionId, true);
      commit(decoded.state);
      if (decoded.action.type === "ack-image-ok") {
        await invoke("ack_overlay_image", { sessionId, ok: true });
      }
    } catch (error) {
      if (loadEpochRef.current !== epoch || uiRef.current.sessionId !== sessionId) return;
      const decoded = onImageDecoded(uiRef.current, sessionId, false);
      commit(decoded.state);
      if (decoded.action.type === "ack-image-failed") {
        await invoke("ack_overlay_image", {
          sessionId,
          ok: false,
          message: error instanceof Error ? error.message : "底图加载失败",
        });
      }
    }
  }, [commit]);

  useEffect(() => {
    let alive = true;
    let unlistenSession: (() => void) | undefined;
    let unlistenHide: (() => void) | undefined;
    void (async () => {
      unlistenSession = await listen<OverlaySessionPayload>("overlay-session", (event) => {
        if (alive) void acceptPayload(normalizePayload(event.payload));
      });
      unlistenHide = await listen<{ sessionId: string }>("overlay-hide", (event) => {
        if (!alive) return;
        const decision = onSessionHide(uiRef.current, event.payload.sessionId);
        if (decision.resetDrag) commit(decision.state);
      });
      if (!alive) {
        unlistenSession();
        unlistenHide();
        return;
      }
      const pending = await invoke<OverlaySessionPayload | null>("get_pending_overlay");
      if (alive && pending) await acceptPayload(normalizePayload(pending));
    })();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sessionRef.current) {
        void invoke("close_overlay", { sessionId: sessionRef.current });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      alive = false;
      unlistenSession?.();
      unlistenHide?.();
      window.removeEventListener("keydown", handleKeyDown);
      resetDrag();
    };
  }, [acceptPayload, commit, resetDrag]);

  const toScreenRect = useCallback((screenX: number, screenY: number): ScreenRect | null => {
    const dragStart = startRef.current;
    const bounds = monitorBoundsRef.current;
    if (!dragStart || !bounds) return null;
    const scale = scaleRef.current;
    const x = Math.min(dragStart.screenX, screenX);
    const y = Math.min(dragStart.screenY, screenY);
    const width = Math.abs(screenX - dragStart.screenX);
    const height = Math.abs(screenY - dragStart.screenY);
    return {
      x: Math.round(x * scale),
      y: Math.round(y * scale),
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }, []);

  const finishSelection = useCallback(async (screenX: number, screenY: number) => {
    if (!selectingRef.current || !startRef.current) return;
    const sessionId = sessionRef.current;
    const screenRect = toScreenRect(screenX, screenY);
    selectingRef.current = false;
    startRef.current = null;
    pendingRectRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!sessionId || !screenRect || screenRect.width < 5 || screenRect.height < 5) return;
    commit({ ...uiRef.current, loading: true, error: null });
    try {
      await invoke("show_popup_with_ocr", {
        sessionId,
        x: screenRect.x,
        y: screenRect.y,
        width: screenRect.width,
        height: screenRect.height,
      });
      const settled = onOcrSettled(uiRef.current, sessionId, null);
      if (settled.apply) commit(settled.state);
    } catch (error) {
      const settled = onOcrSettled(uiRef.current, sessionId, String(error));
      if (settled.apply) commit(settled.state);
    }
  }, [commit, toScreenRect]);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (!selectingRef.current) return;
      void finishSelection(event.screenX, event.screenY);
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [finishSelection]);

  const handleMouseDown = (event: React.MouseEvent) => {
    const current = uiRef.current;
    if (current.loading || !monitorBoundsRef.current) return;
    if (current.mode === "freeze" && current.imageGate !== "loaded") return;
    event.preventDefault();
    const dragStart: DragStart = {
      clientX: event.clientX,
      clientY: event.clientY,
      screenX: event.screenX,
      screenY: event.screenY,
    };
    selectingRef.current = true;
    startRef.current = dragStart;
    setVisualRect({ x: event.clientX, y: event.clientY, width: 0, height: 0 });
    commit({ ...current, error: null });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!selectingRef.current || !startRef.current) return;
    pendingRectRef.current = {
      x: Math.min(startRef.current.clientX, event.clientX),
      y: Math.min(startRef.current.clientY, event.clientY),
      width: Math.abs(event.clientX - startRef.current.clientX),
      height: Math.abs(event.clientY - startRef.current.clientY),
    };
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRectRef.current) setVisualRect(pendingRectRef.current);
    });
  };

  const showChrome = ui.mode === "live" || ui.imageGate === "loaded";

  return (
    <div
      className="overlay-root"
      data-overlay-session={ui.sessionId ?? ""}
      data-image-gate={ui.imageGate}
      data-overlay-mode={ui.mode ?? ""}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {ui.freezeFrame && (
        <img src={ui.freezeFrame} alt="" className="overlay-freeze-image" draggable={false} />
      )}
      {showChrome && <div className="overlay-dim" />}
      {showChrome && (
        <div className="overlay-hint">
          {ui.loading ? "识别中..." : "拖选要翻译的区域 · Esc 取消"}
        </div>
      )}
      {ui.error && <div className="overlay-error">{ui.error}</div>}
      {visualRect && visualRect.width > 0 && visualRect.height > 0 && (
        <div
          className="selection-box"
          style={{
            left: visualRect.x,
            top: visualRect.y,
            width: visualRect.width,
            height: visualRect.height,
          }}
        />
      )}
    </div>
  );
}
