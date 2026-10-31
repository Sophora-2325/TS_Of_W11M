const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execSync } = require("child_process");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const USERDATA = "D:\\STOR\\.cache\\edge-cdp";
const OUT = "D:\\STOR\\.cache\\guides\\shots";
const WIDTH = Number(process.env.W || 390);
const HEIGHT = Number(process.env.H || 900);
const PAGES = [
  { name: "tech", file: "technical-stack.html", sections: ["#stack", "#ocr", "#evidence", "#quiz"] },
  { name: "plan", file: "implementation-plan.html", sections: ["#stages", "#targets", "#delivery", "#quiz"] },
];

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

async function waitForPort() {
  for (let i = 0; i < 60; i += 1) {
    try {
      return await getJSON(`http://127.0.0.1:${PORT}/json/version`);
    } catch (err) {
      await sleep(200);
    }
  }
  throw new Error("Edge debugging port did not open");
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.loadWaiters = [];
    this.exceptions = [];
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(JSON.stringify(msg.error)));
          else res(msg.result);
        } else if (msg.method === "Page.loadEventFired") {
          this.loadWaiters.splice(0).forEach((fn) => fn());
        } else if (msg.method === "Runtime.exceptionThrown") {
          this.exceptions.push(msg.params.exceptionDetails.text || "exception");
        }
      });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  waitLoad(timeout = 6000) {
    return Promise.race([
      new Promise((resolve) => this.loadWaiters.push(resolve)),
      sleep(timeout),
    ]);
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "evaluate failed");
    }
    return result.result.value;
  }
  async shot(file) {
    const result = await this.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  }
  close() {
    try {
      this.ws.close();
    } catch (err) {
      // ignore
    }
  }
}

(async () => {
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${USERDATA}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    await waitForPort();
    const targets = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
    const target = targets.find((item) => item.type === "page");
    if (!target) throw new Error("No page target");

    const cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: WIDTH,
      screenHeight: HEIGHT,
    });

    const report = [];
    for (const page of PAGES) {
      const url = `file:///D:/STOR/docs/android-plan/${page.file}`;
      const loaded = cdp.waitLoad();
      await cdp.send("Page.navigate", { url });
      await loaded;
      await sleep(700);

      const base = await cdp.eval(
        `JSON.stringify({innerWidth:innerWidth,innerHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,scrollHeight:document.documentElement.scrollHeight})`
      );
      report.push(`${page.name} base ${base}`);

      const overflow = await cdp.eval(
        `JSON.stringify([...document.querySelectorAll('body *')].filter(function(el){var r=el.getBoundingClientRect();var cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.position!=='fixed'&&(r.right>innerWidth+1||r.left<-1);}).slice(0,20).map(function(el){return {tag:el.tagName,cls:(el.className&&el.className.toString().slice(0,50))||'',right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)};}))`
      );
      report.push(`${page.name} overflow ${overflow}`);

      await cdp.shot(path.join(OUT, `${page.name}-${WIDTH}-hero.png`));
      for (const sel of page.sections) {
        const id = sel.slice(1);
        await cdp.eval(
          `window.scrollTo({top:document.getElementById(${JSON.stringify(id)}).getBoundingClientRect().top+window.scrollY-70,behavior:'instant'})`
        );
        await sleep(250);
        await cdp.shot(path.join(OUT, `${page.name}-${WIDTH}-${id}.png`));
      }

      // Quiz interaction
      await cdp.eval(`window.scrollTo({top:document.getElementById('quiz').getBoundingClientRect().top+window.scrollY-70,behavior:'instant'})`);
      await sleep(150);
      const quiz = await cdp.eval(
        `(() => {const first=document.querySelector('.quiz-item input'); if(!first) return 'no quiz'; first.click(); return JSON.stringify({score:document.getElementById('quiz-score').textContent, feedback:document.querySelector('.q-feedback').innerText.slice(0,40), disabled:document.querySelectorAll('.quiz-item input:disabled').length});})()`
      );
      report.push(`${page.name} quiz ${quiz}`);
      await cdp.shot(path.join(OUT, `${page.name}-${WIDTH}-quiz-answered.png`));

      if (WIDTH < 600) {
      // TOC dialog at mobile
      await cdp.eval(`window.scrollTo(0,0)`);
      await sleep(150);
      const dialog = await cdp.eval(
        `(() => {const d=document.getElementById('toc-dialog');document.getElementById('toc-open').click();const open=d.open;return JSON.stringify({open:open,width:Math.round(d.getBoundingClientRect().width)});})()`
      );
      report.push(`${page.name} dialog ${dialog}`);
      await sleep(250);
      await cdp.shot(path.join(OUT, `${page.name}-${WIDTH}-dialog.png`));
      await cdp.eval(`document.getElementById('toc-dialog').close()`);

      }
      report.push(`${page.name} exceptions ${JSON.stringify(cdp.exceptions)}`);
    }

    fs.writeFileSync(path.join(OUT, "report.txt"), report.join("\n"), "utf8");
    console.log(report.join("\n"));
    cdp.close();
  } finally {
    try {
      execSync(`taskkill /PID ${edge.pid} /T /F`, { stdio: "ignore" });
    } catch (err) {
      // ignore
    }
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

