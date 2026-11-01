/*
  Renders site/resume/index.html into the PDF the page offers: one long receipt,
  exactly as tall as the résumé, with real text you can select and search:
  npm run resume:pdf. Needs Chrome; set CHROME to its path if it isn't in the usual place.

  Also writes resume.sha256, the hash of the page and stylesheet it printed, so
  test/resume.test.ts can tell when the PDF is stale.
*/
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { PDF } from "./resume.ts";

const DIR = resolve(import.meta.dirname, "..", "site", "resume");
/** 146 mm of receipt on a strip of desk. */
const WIDTH_MM = 170;
const CHROMES: Readonly<Record<string, string>> = {
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "google-chrome"
};

/** What a PDF was printed from: the page and its stylesheet. */
export function sourceHash(dir = DIR): string {
  const hash = createHash("sha256");
  for (const file of ["index.html", "resume.css"]) hash.update(readFileSync(join(dir, file)));
  return hash.digest("hex");
}

type Json = Record<string, unknown>;

/** Just enough of the DevTools protocol to load a page and print it. */
async function connect(url: string) {
  const ws = new WebSocket(url);
  await new Promise((done, fail) => {
    ws.addEventListener("open", done, { once: true });
    ws.addEventListener("error", fail, { once: true });
  });
  let last = 0;
  const pending = new Map<number, (message: Json) => void>();
  const waiting = new Map<string, () => void>();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as Json;
    const id = message["id"];
    const method = message["method"];
    if (typeof id === "number") pending.get(id)?.(message);
    else if (typeof method === "string") waiting.get(method)?.();
  });
  const send = (method: string, params: Json = {}): Promise<Json> => new Promise((done, fail) => {
    const id = ++last;
    pending.set(id, (message) => {
      pending.delete(id);
      const error = message["error"] as { readonly message?: string } | undefined;
      if (error) fail(new Error(`${method}: ${error.message ?? "failed"}`));
      else done((message["result"] ?? {}) as Json);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (event: string): Promise<void> => new Promise((done) => {
    waiting.set(event, () => {
      waiting.delete(event);
      done();
    });
  });
  const evaluate = async (expression: string): Promise<unknown> => {
    const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    return (reply["result"] as { readonly value?: unknown } | undefined)?.value;
  };
  return { send, once, evaluate, close: () => ws.close() };
}

/** Chrome writes the port it picked into the profile once it's listening. */
async function devtoolsPort(profile: string): Promise<number> {
  const file = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 150; i += 1) {
    if (existsSync(file)) {
      const port = Number(readFileSync(file, "utf8").split("\n")[0]);
      if (port > 0) return port;
    }
    await sleep(100);
  }
  throw new Error("Chrome didn't start. Set CHROME to its path.");
}

async function main(): Promise<void> {
  const chrome = process.env["CHROME"] ?? CHROMES[process.platform] ?? "google-chrome";
  const profile = mkdtempSync(join(tmpdir(), "resume-pdf-"));
  const proc = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore" });
  try {
    const port = await devtoolsPort(profile);
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json() as { readonly webSocketDebuggerUrl: string };
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    // Lay the page out as it prints: print media, light paper, the PDF's width.
    await cdp.send("Emulation.setEmulatedMedia", { media: "print", features: [{ name: "prefers-color-scheme", value: "light" }] });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: Math.round((WIDTH_MM / 25.4) * 96), height: 900, deviceScaleFactor: 1, mobile: false });
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: pathToFileURL(join(DIR, "index.html")).href });
    await loaded;
    const height = Number(await cdp.evaluate(`document.documentElement.classList.add("pdf");
      document.fonts.ready.then(() => Math.ceil(document.documentElement.getBoundingClientRect().height))`));
    const { data } = await cdp.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: false,
      paperWidth: WIDTH_MM / 25.4,
      paperHeight: (height + 2) / 96,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      generateTaggedPDF: true
    }) as { readonly data: string };
    cdp.close();
    const pdf = Buffer.from(data, "base64");
    const pages = Number(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/.exec(pdf.toString("latin1"))?.[1] ?? 0);
    if (pages !== 1) throw new Error(`Expected one long page, got ${pages}.`);
    writeFileSync(join(DIR, PDF), pdf);
    writeFileSync(join(DIR, "resume.sha256"), `${sourceHash()}\n`);
    console.log(`wrote site/resume/${PDF}: ${Math.round(pdf.length / 1024)} KB, ${WIDTH_MM} × ${Math.round(((height + 2) / 96) * 25.4)} mm, one page`);
  } finally {
    proc.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
