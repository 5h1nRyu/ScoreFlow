const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf" };
let server;
let browser;
let baseURL;
const options = (scale = 1, width = 960, height = 540) => ({
  fps: 60, viewport: { width, height }, output: { width: width * scale, height: height * scale }, deviceScaleFactor: scale, seed: 42
});

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error("路径无效");
      const data = await readFile(file);
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
});

async function openExport(o = options(), modify) {
  const page = await browser.newPage({ viewport: o.viewport, deviceScaleFactor: o.deviceScaleFactor });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(o => {
    window.__VIDEO_EXPORT_REQUEST__ = Object.freeze(o);
    window.createdCanvases = [];
    const create = document.createElement;
    document.createElement = function (...args) {
      const element = Reflect.apply(create, this, args);
      if (element instanceof HTMLCanvasElement) createdCanvases.push(element);
      return element;
    };
    window.scheduledWork = { frames: 0, timers: 0, observers: 0 };
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (...args) => { scheduledWork.frames++; return raf(...args); };
    const timeout = window.setTimeout;
    window.setTimeout = (...args) => { scheduledWork.timers++; return timeout(...args); };
    const Observer = window.ResizeObserver;
    window.ResizeObserver = class extends Observer {
      constructor(callback) { super(callback); scheduledWork.observers++; }
    };
  }, o);
  if (modify) await modify(page);
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__VIDEO_EXPORT__);
  page.pageErrors = errors;
  return page;
}

async function prepare(page, o = options()) {
  await page.evaluate(o => __VIDEO_EXPORT__.prepare(o), o);
  await page.evaluate(() => __VIDEO_EXPORT__.reset());
}

async function advance(page, from, to) {
  // Yield browser tasks between small batches. VideoMaker itself evaluates each frame separately;
  // thousands of draws in one JS task retain temporary canvas snapshots until that task returns.
  for (let start = from; start <= to; start += 20) {
    await page.evaluate(async ({ from, to }) => {
      for (let index = from; index <= to; index++) {
        await __VIDEO_EXPORT__.renderFrame({ index, timeMs: index * 1000 / 60, deltaMs: index === 0 ? 0 : 1000 / 60 });
      }
    }, { from: start, to: Math.min(to, start + 19) });
  }
}

test("metadata works before prepare; export startup schedules no playback; metadata-only disposal is safe", async () => {
  const page = await openExport();
  try {
    const manifest = await page.evaluate(() => __VIDEO_EXPORT__.getManifest());
    assert.equal(manifest.durationMs, 66900);
    assert.equal(manifest.supportsSeeking, false);
    assert.deepEqual(manifest.recommendedViewport, { width: 1920, height: 1080 });
    assert(manifest.name.length);
    assert.equal(await page.evaluate(() => __VIDEO_EXPORT__.version), 1);
    const before = await page.screenshot({ animations: "allow" });
    await page.waitForTimeout(120);
    assert.deepEqual(await page.screenshot({ animations: "allow" }), before);
    assert.deepEqual(await page.evaluate(() => scheduledWork), { frames: 0, timers: 0, observers: 0 });
    await page.evaluate(() => { __VIDEO_EXPORT__.dispose(); __VIDEO_EXPORT__.dispose(); });
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("every frame in a complete 4014-frame cycle reproduces its Canvas PNG and DOM after reset", { timeout: 180000 }, async () => {
  const page = await openExport();
  try {
    await prepare(page);
    const result = await page.evaluate(async () => {
      const count = Math.ceil((await __VIDEO_EXPORT__.getManifest()).durationMs * 60 / 1000);
      const hashes = [];
      const phases = new Set();
      // Attribute order changes when hidden is removed/re-added, but does not affect state or pixels.
      const serialize = node => node.nodeType === Node.ELEMENT_NODE
          ? [node.tagName, Array.from(node.attributes, attr => [attr.name, attr.value])
              .sort((a, b) => a[0].localeCompare(b[0])), Array.from(node.childNodes, serialize)]
          : node.textContent;
      for (let pass = 0; pass < 2; pass++) {
        __VIDEO_EXPORT__.reset();
        for (let index = 0; index < count; index++) {
          __VIDEO_EXPORT__.renderFrame({ index, timeMs: index * 1000 / 60, deltaMs: index === 0 ? 0 : 1000 / 60 });
          phases.add(document.querySelector("#dashboard").dataset.phase);
          const snapshot = document.querySelector("#scoreChart").toDataURL()
              + JSON.stringify(serialize(document.querySelector("#dashboard")));
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshot)))).join(",");
          if (pass === 0) hashes.push(hash);
          else if (hash !== hashes[index]) return { mismatch: index, count };
        }
      }
      return { count, phases: [...phases], work: scheduledWork, animations: document.getAnimations().length };
    });
    assert.equal(result.mismatch, undefined, `frame mismatch: ${result.mismatch}`);
    assert.equal(result.count, 4014);
    assert.deepEqual(result.phases, ["background-hold", "entrance", "playing", "last-game-hold", "game-table-exit", "overview", "restart-hold"]);
    assert.deepEqual(result.work, { frames: 0, timers: 0, observers: 0 });
    assert.equal(result.animations, 0);
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("1080p screenshots stay fixed across real waits, keyboard input, reset and segment pre-roll", { timeout: 240000 }, async () => {
  const o = options(1, 1920, 1080);
  const page = await openExport(o);
  try {
    await prepare(page, o);
    const shots = new Map();
    let from = 0;
    // Include opening, both halves of table changes, chart width change, titles and final hold.
    for (const index of [0, 330, 428, 600, 630, 650, 800, 3390, 3500, 3600, 3605, 3610, 3700, 3990]) {
      await advance(page, from, index);
      from = index + 1;
      const shot = await page.screenshot({ animations: "allow" });
      shots.set(index, shot);
      await page.waitForTimeout(index === 630 ? 350 : 35);
      assert.deepEqual(await page.screenshot({ animations: "allow" }), shot, `frame ${index} moved after return`);
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(80);
    assert.deepEqual(await page.screenshot({ animations: "allow" }), shots.get(3990));
    await page.evaluate(() => __VIDEO_EXPORT__.reset());
    await advance(page, 0, 0);
    assert.deepEqual(await page.screenshot({ animations: "allow" }), shots.get(0));
    await advance(page, 1, 630); // VideoMaker pre-roll for a segment starting inside a table entrance.
    assert.deepEqual(await page.screenshot({ animations: "allow" }), shots.get(630));
    await advance(page, 631, 3605); // Continue pre-roll to a segment inside the leaderboard title transition.
    assert.deepEqual(await page.screenshot({ animations: "allow" }), shots.get(3605));
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("4K and DPR 3 increase both canvases without changing layout; prepare can be repeated", async () => {
  for (const scale of [2, 3]) {
    const o = options(scale, 1920, 1080);
    const page = await openExport(o, page => page.route("**/src/config/config.js", async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/backgroundHoldDuration: 5000/, "backgroundHoldDuration: 0")
          .replace(/entranceDuration: 2000/, "entranceDuration: 0");
      await route.fulfill({ response, body });
    }));
    try {
      await prepare(page, o);
      await advance(page, 0, 30);
      const dimensions = await page.evaluate(() => {
        const c = document.querySelector("#scoreChart");
        return { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight,
          labels: createdCanvases.map(canvas => [canvas.width, canvas.height]),
          viewport: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
      });
      assert.equal(dimensions.width, Math.round(dimensions.cssWidth * scale));
      assert.equal(dimensions.height, Math.round(dimensions.cssHeight * scale));
      assert.deepEqual(dimensions.labels, [[dimensions.width, dimensions.height]]);
      assert.deepEqual(dimensions.viewport, [1920, 1080]);
      const shot = await page.screenshot({ animations: "allow" });
      assert.equal(shot.readUInt32BE(16), o.output.width);
      assert.equal(shot.readUInt32BE(20), o.output.height);
      await prepare(page, o);
      await advance(page, 0, 30);
      assert.deepEqual(await page.screenshot({ animations: "allow" }), shot);
    } finally { await page.close(); }
  }
});

test("prepare settles missing optional images, including later games; no resources load during frames", async () => {
  const page = await openExport(options(), async page => {
    await page.route("**/assets/images/players/*", route => route.fulfill({ status: 404, body: "Missing" }));
    await page.route("**/assets/images/icons/*", route => route.fulfill({ status: 404, body: "Missing" }));
  });
  try {
    await prepare(page);
    const requests = [];
    page.on("request", request => requests.push(request.url()));
    await advance(page, 0, 3500);
    assert(await page.locator(".team-table__logo--missing").count() > 0);
    assert.deepEqual(requests, []);
    await page.evaluate(() => __VIDEO_EXPORT__.reset());
    await advance(page, 0, 800);
    assert(await page.locator(".game-table__portrait--missing").count() > 0);
    assert.deepEqual(requests, []);
  } finally { await page.close(); }
});

test("required data, background and font failures reject preparation", async () => {
  for (const pattern of ["**/data/games.json", "**/assets/images/background/paper.jpg", "**/assets/font/*"]) {
    const page = await openExport(options(), page => page.route(pattern, route => route.fulfill({ status: 404, body: "Missing" })));
    try {
      await assert.rejects(() => prepare(page));
      await page.evaluate(() => __VIDEO_EXPORT__.dispose());
      assert.deepEqual(await page.evaluate(() => scheduledWork), { frames: 0, timers: 0, observers: 0 });
    } finally { await page.close(); }
  }
});

test("invalid options, premature frames and nonsequential global indices are rejected", async () => {
  const page = await openExport();
  try {
    await assert.rejects(() => page.evaluate(() => __VIDEO_EXPORT__.reset()));
    for (const invalid of [{ ...options(), fps: 30 }, { ...options(), seed: -1 }, { ...options(), deviceScaleFactor: 0 }, { ...options(), output: { width: 10, height: 10 } }]) {
      await assert.rejects(() => page.evaluate(o => __VIDEO_EXPORT__.prepare(o), invalid));
    }
    await prepare(page);
    await assert.rejects(() => advance(page, 600, 600));
    await assert.rejects(() => page.evaluate(() => __VIDEO_EXPORT__.renderFrame({ index: 0, timeMs: 0, deltaMs: 1000 / 60 })));
    await advance(page, 0, 0);
    await assert.rejects(() => advance(page, 0, 0));
    await page.evaluate(() => __VIDEO_EXPORT__.dispose());
    await assert.rejects(() => advance(page, 1, 1));
  } finally { await page.close(); }
});

test("zero-duration phases and odd debug game counts retain correct layout and initial frame", async () => {
  const page = await openExport(options(), page => page.route("**/src/config/config.js", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/backgroundHoldDuration: 5000/, "backgroundHoldDuration: 0")
        .replace(/entranceDuration: 2000/, "entranceDuration: 0")
        .replace(/gameTableExitDuration: 400/, "gameTableExitDuration: 0")
        .replace(/rowTransitionDuration: 220/, "rowTransitionDuration: 0")
        .replace(/rowTransitionDelay: 35/, "rowTransitionDelay: 0")
        .replace(/titleTransitionDuration: 180/, "titleTransitionDuration: 0")
        .replace(/finalGameId: -1/, "finalGameId: 2");
    await route.fulfill({ response, body });
  }));
  try {
    assert.equal((await page.evaluate(() => __VIDEO_EXPORT__.getManifest())).durationMs, 16000);
    await prepare(page);
    await advance(page, 0, 0);
    assert.equal(await page.locator("#dashboard").getAttribute("data-phase"), "playing");
    assert.equal(await page.locator("#gameTable .game-table__row").count(), 8);
    assert(await page.locator("#gameTable .game-table__row").evaluateAll(rows => rows.every(row => row.style.opacity === "1")));
    await advance(page, 1, 180);
    assert.equal(await page.locator("#gameTable .game-table__row").count(), 4);
    assert(await page.locator("#gameTable .game-table__row").evaluateAll(rows => rows.every(row => row.style.opacity === "1")));
    await advance(page, 181, 360);
    assert.equal(await page.locator("#dashboard").getAttribute("data-phase"), "overview");
    assert(await page.locator("#teamTableSlot").isVisible());
    assert.equal(await page.locator(".team-table__title").evaluate(title => title.style.opacity), "1");
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("dispose cancels data preparation in flight and remains safe to repeat", async () => {
  let resolveRequest;
  const requested = new Promise(resolve => { resolveRequest = resolve; });
  const page = await openExport(options(), page => page.route("**/data/games.json", route => { resolveRequest(route); }));
  try {
    const pending = page.evaluate(o => __VIDEO_EXPORT__.prepare(o), options())
        .then(() => null, error => error.message);
    const route = await requested;
    await page.evaluate(() => { __VIDEO_EXPORT__.dispose(); __VIDEO_EXPORT__.dispose(); });
    assert(await pending);
    await route.abort().catch(() => {});
    assert.deepEqual(await page.evaluate(() => scheduledWork), { frames: 0, timers: 0, observers: 0 });
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("normal playback still pauses the whole page, resumes, reaches overview and restarts", { timeout: 30000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Shorten only durations in the test to observe a full normal cycle without a 67-second wait.
  await page.route("**/src/config/config.js", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/backgroundHoldDuration: 5000/, "backgroundHoldDuration: 100")
        .replace(/entranceDuration: 2000/, "entranceDuration: 100")
        .replace(/gameDuration: 1500/, "gameDuration: 150")
        .replace(/restartDelay: 3000/, "restartDelay: 100");
    await route.fulfill({ response, body });
  });
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "playing");
    assert(await page.locator("#dataError").isHidden());
    await page.keyboard.press("Space");
    const shot = await page.screenshot({ animations: "allow" });
    await page.waitForTimeout(300);
    assert.deepEqual(await page.screenshot({ animations: "allow" }), shot);
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    assert.notDeepEqual(await page.screenshot({ animations: "allow" }), shot);
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "overview");
    assert(await page.locator("#teamTableSlot").isVisible());
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "background-hold");
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
