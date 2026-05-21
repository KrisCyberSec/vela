#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import WebSocket from "ws";

const exec = promisify(execFile);

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = process.cwd();
const baseUrl = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const outRoot = path.join(root, "screenshots");

const deviceSets = [
  { key: "67", cssWidth: 430, cssHeight: 932, pixelWidth: 1290, pixelHeight: 2796 },
  { key: "65", cssWidth: 428, cssHeight: 926, pixelWidth: 1284, pixelHeight: 2778 },
];

const frames = [
  { file: "01-welcome.png", param: "welcome" },
  { file: "02-insights.png", param: "insights" },
  { file: "03-ask-vela.png", param: "ask-vela" },
  { file: "04-today.png", param: "today" },
  { file: "05-paywall.png", param: "paywall" },
  { file: "06-history.png", param: "history" },
];

function urlFor(frame) {
  const params = new URLSearchParams();
  params.set("screenshot", frame.param);
  if (frame.param !== "welcome") params.set("seed", "demo");
  return `${baseUrl}/?${params.toString()}`;
}

async function capture(set, frame) {
  const outDir = path.join(outRoot, set.key);
  const out = path.join(outDir, frame.file);
  await mkdir(outDir, { recursive: true });
  const browser = await launchChrome(frame, set);
  try {
    const pageTargets = await getJson(`http://127.0.0.1:${browser.port}/json/list`);
    const page = pageTargets.find((target) => target.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a page target");

    const cdp = await CdpSession.connect(page.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: set.cssWidth,
        height: set.cssHeight,
        deviceScaleFactor: 3,
        mobile: true,
        screenWidth: set.cssWidth,
        screenHeight: set.cssHeight,
      });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

      const loaded = cdp.waitEvent("Page.loadEventFired", 12000);
      await cdp.send("Page.navigate", { url: urlFor(frame) });
      await loaded;
      await cdp.send("Runtime.evaluate", {
        expression: "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
        awaitPromise: true,
      });
      await wait(2200);

      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(out, Buffer.from(shot.data, "base64"));
    } finally {
      cdp.close();
    }
  } finally {
    await browser.close();
  }
  const { stdout } = await exec("sips", ["-g", "pixelWidth", "-g", "pixelHeight", out]);
  const width = Number(stdout.match(/pixelWidth:\s+(\d+)/)?.[1]);
  const height = Number(stdout.match(/pixelHeight:\s+(\d+)/)?.[1]);
  if (width !== set.pixelWidth || height !== set.pixelHeight) {
    throw new Error(`${out} is ${width}x${height}; expected ${set.pixelWidth}x${set.pixelHeight}`);
  }
  console.log(`${path.relative(root, out)} ${width}x${height}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
  });
}

async function launchChrome(frame, set) {
  const profile = await mkdtemp(path.join(tmpdir(), `vela-shot-${set.key}-${frame.param}-`));
  const child = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let exited = false;
  const exitPromise = new Promise((resolve) => child.once("exit", resolve));
  child.on("exit", () => {
    exited = true;
  });

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for Chrome DevTools")), 10000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited before DevTools was ready, code ${code}`));
    });
    child.stderr.on("data", (chunk) => {
      const match = String(chunk).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
  });

  return {
    port,
    async close() {
      if (!exited) child.kill("SIGTERM");
      if (!exited) await exitPromise;
      await rm(profile, { recursive: true, force: true });
    },
  };
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.ws.on("message", (raw) => this.handleMessage(raw));
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.once("open", () => resolve(new CdpSession(ws)));
      ws.once("error", reject);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }), (err) => {
        if (!err) return;
        this.pending.delete(id);
        reject(err);
      });
    });
  }

  waitEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.events.get(method) || [];
        this.events.set(method, waiters.filter((waiter) => waiter !== onEvent));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const onEvent = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      const waiters = this.events.get(method) || [];
      waiters.push(onEvent);
      this.events.set(method, waiters);
    });
  }

  handleMessage(raw) {
    const msg = JSON.parse(raw);
    if (msg.id) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message || "Chrome DevTools error"));
      } else {
        pending.resolve(msg.result || {});
      }
      return;
    }
    if (!msg.method) return;
    const waiters = this.events.get(msg.method) || [];
    if (waiters.length === 0) return;
    const [waiter, ...rest] = waiters;
    this.events.set(msg.method, rest);
    waiter(msg.params || {});
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  await exec("curl", ["-fsS", baseUrl], { timeout: 5000 });
  for (const set of deviceSets) {
    for (const frame of frames) {
      await capture(set, frame);
    }
  }
  console.log("Generated 12 App Store screenshots.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
