const fs = require("fs");
const http = require("http");
const { spawn, execSync } = require("child_process");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const USERDATA = "D:\\STOR\\.cache\\edge-printcheck";
const OUT = "D:\\STOR\\.cache\\guides\\printcheck";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${USERDATA}`, "about:blank"
  ], { stdio: "ignore" });
  try {
    for (let i = 0; i < 60; i += 1) {
      try { await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); }
    }
    const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
    const target = targets.find((t) => t.type === "page");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const waits = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      } else if (msg.method === "Page.loadEventFired") {
        waits.splice(0).forEach((fn) => fn());
      }
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 800, height: 1100, deviceScaleFactor: 1, mobile: false, screenWidth: 800, screenHeight: 1100
    });
    await send("Emulation.setEmulatedMedia", { media: "print" });

    const report = [];
    for (const file of ["technical-stack.html", "implementation-plan.html"]) {
      const loaded = new Promise((r) => waits.push(r));
      await send("Page.navigate", { url: `file:///D:/STOR/docs/android-plan/${file}` });
      await Promise.race([loaded, sleep(5000)]);
      await sleep(600);
      const state = await evaluate(`JSON.stringify({
        demo:getComputedStyle(document.querySelector('.demo')).display,
        docSwitch:getComputedStyle(document.querySelector('.doc-switch')).display,
        printToc:getComputedStyle(document.querySelector('.print-toc')).display,
        quiz:getComputedStyle(document.querySelector('.quiz-section')).display,
        calc:document.querySelector('.calc') ? getComputedStyle(document.querySelector('.calc')).display : 'none',
        scrollWidth:document.documentElement.scrollWidth
      })`);
      report.push(`${file}: ${state}`);
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      fs.writeFileSync(`${OUT}/${file.replace('.html', '')}-print.png`, Buffer.from(shot.data, "base64"));
    }
    fs.writeFileSync(`${OUT}/report.txt`, report.join("\n"), "utf8");
    console.log(report.join("\n"));
    ws.close();
  } finally {
    try { execSync(`taskkill /PID ${edge.pid} /T /F`, { stdio: "ignore" }); } catch (e) { /* ignore */ }
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
