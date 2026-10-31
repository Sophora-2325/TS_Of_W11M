import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const exe = "D:\\STOR\\src-tauri\\target\\release\\stor.exe";
const port = 9231;
const evidence = "D:\\STOR\\audit\\evidence";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, fn, timeoutMs) {
  const start = Date.now();
  let lastError = "timeout";
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(200);
  }
  throw new Error(`${label}: ${lastError}`);
}

function startApp() {
  const child = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
    stdio: "ignore",
    windowsHide: false,
  });
  return child;
}

function stopApp(pid) {
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
}

async function targets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`cdp ${response.status}`);
  const pages = await response.json();
  return pages.filter((page) => page.type === "page" && page.webSocketDebuggerUrl);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function connect(url) {
  const ws = new WebSocket(url);
  let next = 0;
  const pending = new Map();
  const opened = withTimeout(new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("cdp websocket failed")));
  }), 3000, "cdp open");
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  return {
    opened,
    send(method, params = {}) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(page, expression) {
  const client = connect(page.webSocketDebuggerUrl);
  await client.opened;
  try {
    const result = await withTimeout(client.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }), 15000, "cdp evaluate");
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails.exception || result.exceptionDetails));
    }
    return result.result?.value;
  } finally {
    client.close();
  }
}

async function pagesByLabel() {
  const pages = await targets();
  const labeled = [];
  for (const page of pages) {
    try {
      const label = await evaluate(page, "window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label || ''");
      labeled.push({ ...page, label });
    } catch {
      labeled.push({ ...page, label: "" });
    }
  }
  return labeled;
}

async function page(label) {
  const pages = await pagesByLabel();
  const found = pages.find((item) => item.label === label);
  if (!found) throw new Error(`missing ${label}; have ${pages.map((item) => item.label).join(",")}`);
  return found;
}

async function invoke(label, command, args = {}) {
  const target = await page(label);
  const expression = `(async () => window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)}))()`;
  return evaluate(target, expression);
}

async function overlayView() {
  const target = await page("overlay");
  return evaluate(target, `(() => {
    const root = document.querySelector('.overlay-root');
    const image = document.querySelector('.overlay-freeze-image');
    return {
      sessionId: root?.dataset.overlaySession || '',
      gate: root?.dataset.imageGate || '',
      mode: root?.dataset.overlayMode || '',
      complete: Boolean(image?.complete),
      width: image?.naturalWidth || 0,
      height: image?.naturalHeight || 0,
      hint: document.querySelector('.overlay-hint')?.textContent || '',
    };
  })()`);
}

async function windowState() {
  const target = await page("main");
  return evaluate(target, `(async () => {
    const ipc = window.__TAURI_INTERNALS__;
    const labels = await ipc.invoke('plugin:window|get_all_windows');
    const visible = {};
    for (const label of labels) visible[label] = await ipc.invoke('plugin:window|is_visible', { label });
    return { labels, visible };
  })()`);
}

function phasesOf(trace, sessionId) {
  return (trace || []).filter((line) => line.startsWith(`session=${sessionId} `)).map((line) => line.match(/phase=([^ ]+)/)?.[1]);
}

async function waitOverlayReady() {
  return waitFor("overlay ready", async () => {
    const state = await windowState();
    if (!state.visible?.overlay) return null;
    const view = await overlayView();
    if (view.mode === "freeze" && (view.gate !== "loaded" || !view.complete || view.width < 2)) return null;
    if (view.mode === "live" && view.gate !== "skipped") return null;
    return { state, view };
  }, 12000);
}

async function captureOverlay(file) {
  const target = await page("overlay");
  const client = connect(target.webSocketDebuggerUrl);
  await client.opened;
  try {
    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(shot.data, "base64"));
  } finally {
    client.close();
  }
}

async function coldStart(index) {
  const child = startApp();
  try {
    await waitFor("cdp", async () => (await targets()).length > 0, 15000);
    await waitFor("windows", async () => (await pagesByLabel()).some((item) => item.label === "overlay"), 10000);
    const decode = await evaluate(await page("overlay"), `new Promise((resolve) => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve({ ok: true, width: image.naturalWidth })).catch((error) => resolve({ ok: false, error: String(error) }));
      image.onerror = () => resolve({ ok: false, error: 'error' });
      image.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    })`);
    const started = Date.now();
    await invoke("main", "reopen_overlay");
    const ready = await waitOverlayReady();
    const trace = await invoke("main", "get_capture_trace");
    const phases = phasesOf(trace, ready.view.sessionId);
    if (!phases.includes("shown") || !phases.includes("composition-flush")) {
      throw new Error(`phases ${phases.join(",")}`);
    }
    if (ready.view.mode === "freeze" && (!phases.includes("encoded") || !phases.includes("image-ok"))) {
      throw new Error(`freeze phases ${phases.join(",")}`);
    }
    if (index === 1) await captureOverlay(`${evidence}\\gray-lifecycle-cold-1.png`);
    return {
      index,
      pid: child.pid,
      elapsedMs: Date.now() - started,
      decode,
      view: ready.view,
      visible: ready.state.visible,
      phases,
      flat: (trace || []).some((line) => line.includes(`session=${ready.view.sessionId} `) && line.includes("phase=encoded") && line.includes("rgb_spread=0")),
    };
  } finally {
    stopApp(child.pid);
    await sleep(600);
  }
}

async function continuous() {
  const child = startApp();
  console.error("reselect pid", child.pid);
  const rounds = [];
  try {
    await waitFor("cdp", async () => (await targets()).length > 0, 15000);
    await waitFor("popup", async () => (await pagesByLabel()).some((item) => item.label === "popup"), 10000);
    const beforeText = await evaluate(await page("popup"), "document.querySelector('textarea')?.value || ''");
    for (let index = 1; index <= 30; index += 1) {
      const started = Date.now();
      if (index % 7 === 0) {
        await Promise.allSettled([invoke("main", "reopen_overlay"), invoke("main", "reopen_overlay")]);
      } else {
        await invoke("main", "reopen_overlay");
      }
      const ready = await waitOverlayReady();
      const trace = index === 30 || index % 7 === 0 ? await invoke("main", "get_capture_trace") : null;
      const encoded = trace ? trace.filter((line) => line.includes("phase=encoded")).at(-1) : null;
      rounds.push({
        index,
        elapsedMs: Date.now() - started,
        sessionId: ready.view.sessionId,
        gate: ready.view.gate,
        width: ready.view.width,
        height: ready.view.height,
        rapid: index % 7 === 0,
        encoded,
      });
      console.error(`round ${index} session=${ready.view.sessionId} ${Date.now() - started}ms`);
      if (index === 30) await captureOverlay(`${evidence}\\gray-lifecycle-reselect-30.png`);
    }
    const slow = rounds[rounds.length - 1];
    await sleep(6500);
    const pending = await invoke("overlay", "get_pending_overlay");
    let ocr;
    try {
      ocr = {
        ok: true,
        value: await invoke("overlay", "show_popup_with_ocr", {
          sessionId: pending.sessionId,
          x: pending.bounds.x + Math.round(pending.bounds.width / 2) - 300,
          y: pending.bounds.y + Math.round(pending.bounds.height / 2) - 120,
          width: 600,
          height: 220,
        }),
      };
    } catch (error) {
      ocr = { ok: false, error: String(error) };
    }
    await sleep(500);
    const afterOcr = await windowState();
    const textLength = ocr.ok
      ? await evaluate(await page("popup"), "document.querySelector('textarea')?.value?.length || 0")
      : 0;
    if (!ocr.ok) {
      await invoke("overlay", "close_overlay", { sessionId: pending.sessionId });
    }
    await invoke("main", "reopen_overlay");
    const escReady = await waitOverlayReady();
    await invoke("overlay", "close_overlay", { sessionId: escReady.view.sessionId });
    const afterEsc = await waitFor("esc", async () => {
      const state = await windowState();
      return state.visible?.overlay === false ? state : null;
    }, 5000);
    return {
      pid: child.pid,
      rounds,
      slowSession: slow.sessionId,
      ocrReturned: ocr ?? null,
      afterOcr: afterOcr.visible,
      ocrTextLength: textLength,
      afterEsc: afterEsc.visible,
      popupTextBefore: beforeText,
    };
  } finally {
    stopApp(child.pid);
  }
}

async function failureRecovery(beforeText) {
  const child = startApp();
  console.error("recovery pid", child.pid);
  try {
    await waitFor("cdp", async () => (await targets()).length > 0, 15000);
    await waitFor("popup ready", async () => {
      try {
        return await evaluate(await page("popup"), "!!document.querySelector('textarea')");
      } catch {
        return null;
      }
    }, 15000);
    console.error("popup ready");
    const patchDecode = `(() => { HTMLImageElement.prototype.decode = function () { return Promise.reject(new Error("底图解码失败")); }; return true; })()`;
    const patched = await evaluate(await page("overlay"), patchDecode);
    const patchNewPages = (async () => {
      const seen = new Set();
      const until = Date.now() + 8000;
      while (Date.now() < until) {
        let pages = [];
        try { pages = await targets(); } catch { pages = []; }
        for (const item of pages) {
          if (seen.has(item.id)) continue;
          try {
            await evaluate(item, patchDecode);
            seen.add(item.id);
          } catch { /* page may still be starting */ }
        }
        await sleep(30);
      }
    })();
    const text = beforeText || "保留的原文";
    const typed = await evaluate(await page("popup"), `(() => {
      const area = document.querySelector('textarea');
      if (!area) return '';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(area, ${JSON.stringify(text)});
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return area.value;
    })()`);
    const reopenResult = await invoke("popup", "reopen_overlay").then(() => ({ ok: true })).catch((error) => ({ ok: false, error: String(error) }));
    await sleep(800);
    let popup = null;
    let popupError = null;
    try {
      popup = await evaluate(await page("popup"), `(() => ({
        text: document.querySelector('textarea')?.value || '',
        error: document.querySelector('.error-text')?.textContent || '',
        visibleText: document.body?.innerText?.slice(0, 240) || '',
      }))()`);
    } catch (error) {
      popupError = error instanceof Error ? error.message : String(error);
    }
    const state = await windowState();
    const labels = (await pagesByLabel()).map((item) => item.label);
    let prepare = null;
    try { prepare = await invoke("main", "get_prepare_error"); } catch (error) { prepare = String(error); }
    let trace = [];
    try { trace = await invoke("main", "get_capture_trace"); } catch { trace = []; }
    return { patched, typed, reopenResult, visible: state.visible, popup, popupError, labels, prepare, trace };
  } finally {
    stopApp(child.pid);
  }
}

async function luminanceProbe() {
  const child = startApp();
  const shots = [];
  try {
    await waitFor("cdp", async () => (await targets()).length > 0, 15000);
    await waitFor("overlay", async () => (await pagesByLabel()).some((item) => item.label === "overlay"), 10000);
    for (let index = 1; index <= 3; index += 1) {
      await invoke("main", "reopen_overlay");
      await waitOverlayReady();
      const file = `${evidence}\\gray-lifecycle-luma-${index}.png`;
      await captureOverlay(file);
      const trace = await invoke("main", "get_capture_trace");
      shots.push({ index, file, trace: trace.filter((line) => line.includes("phase=encoded")) });
      await invoke("overlay", "close_overlay", { sessionId: String(index) });
    }
    return shots;
  } finally {
    stopApp(child.pid);
  }
}

const lumaOnly = process.argv.includes("--luma");
const skipCold = process.argv.includes("--skip-cold");
const onlyFailure = process.argv.includes("--only-failure");
const summary = { cold: [], continuous: null, failure: null, error: null };
try {
  if (lumaOnly) {
    summary.continuous = { luma: await luminanceProbe() };
  } else {
    if (!skipCold && !onlyFailure) {
      for (let index = 1; index <= 10; index += 1) summary.cold.push(await coldStart(index));
    }
    if (!onlyFailure) summary.continuous = await continuous();
    summary.failure = await failureRecovery("生命周期验收原文");
  }
} catch (error) {
  summary.error = error instanceof Error ? error.stack || error.message : String(error);
}
const output = lumaOnly
  ? `${evidence}\\gray-lifecycle-luma.json`
  : onlyFailure
  ? `${evidence}\\gray-lifecycle-failure.json`
  : skipCold
    ? `${evidence}\\gray-lifecycle-window-rest.json`
    : `${evidence}\\gray-lifecycle-final.json`;
writeFileSync(output, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  cold: summary.cold.length,
  error: summary.error,
  continuousRounds: summary.continuous?.rounds?.length || 0,
}, null, 2));
if (summary.error) process.exitCode = 1;
