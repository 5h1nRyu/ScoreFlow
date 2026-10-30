const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const gameCount = JSON.parse(require("node:fs").readFileSync(path.join(root, "data/games.json"), "utf8")).games.length;
const heroDuration = 6417; // HeroShow dev_v4: bridge + entrance/settle + five-second display.
const heroStart = 5000 + 2000 + (gameCount + 1) * 1500 + 400 + 7000;
const cycleDuration = heroStart + heroDuration + 3000;
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
      let data = await readFile(file);
      // 固定测试时间配置；用户的实际开场停留配置可以独立调整。
      if (pathname === "/src/config/config.js") data = Buffer.from(data.toString().replace(/backgroundHoldDuration:\s*\d+/, "backgroundHoldDuration: 5000"));
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}/`;
  // Software rasterization avoids GPU cache antialiasing differences in pixel-exact snapshots.
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
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
    assert.equal(manifest.durationMs, cycleDuration);
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

test("HeroShow wipes directly over the final overview, displays without UI and resets with the cycle", async () => {
  const page = await openExport(options());
  try {
    await prepare(page);
    const at = async timeMs => {
      await page.evaluate(timeMs => ScoreApplication.renderFrame({ timeMs, deltaMs: 0 }), timeMs);
      return page.evaluate(() => {
        const host = document.getElementById("heroShow");
        const root = host.shadowRoot;
        return {
          hidden: host.hidden,
          phase: document.getElementById("dashboard").dataset.phase,
          background: root.getElementById("viewport").style.background,
          board: root.getElementById("board").style.visibility,
          reveal: root.getElementById("reveal").style.visibility,
          bridge: root.getElementById("bridge").style.visibility,
          controls: root.querySelectorAll("button,input,select,#controls,.transport,.chapters").length,
          score: root.getElementById("score-number").textContent,
          progress: document.getElementById("missionProgress").getAttribute("aria-valuenow"),
        };
      });
    };
    assert.equal((await at(heroStart - 1)).hidden, true);
    const before = await page.screenshot();
    const first = await at(heroStart);
    assert.equal(first.phase, "hero-show");
    assert.equal(first.hidden, false);
    assert.equal(first.board, "hidden");
    assert.equal(first.reveal, "hidden");
    assert.equal(first.bridge, "visible");
    assert.equal(first.background, "transparent");
    assert.equal(first.progress, "100");
    assert.deepEqual(await page.screenshot(), before, "the wipe must start on the exact final ScoreFlow image");
    const entering = await at(heroStart + 200);
    assert.equal(entering.board, "hidden");
    assert.equal(entering.background, "transparent");
    const assembled = await at(heroStart + 330);
    assert.equal(assembled.bridge, "visible");
    const switched = await at(heroStart + 450);
    assert.equal(switched.board, "visible");
    assert.notEqual(switched.background, "transparent");
    const display = await at(heroStart + 1500);
    assert.equal(display.bridge, "hidden");
    assert.equal(display.board, "visible");
    assert.equal(display.controls, 0);
    assert.equal(display.score, "+197.2");
    const hero = await page.screenshot();
    await page.waitForTimeout(120);
    await page.keyboard.press("Space");
    assert.deepEqual(await page.screenshot(), hero, "export must not advance the HeroShow renderer");
    await at(heroStart + 200);
    await at(heroStart + 1500);
    assert.deepEqual(await page.screenshot(), hero, "HeroShow must reproduce a directly requested frame");
    assert.equal((await at(heroStart + heroDuration)).phase, "restart-hold");
    assert.equal((await at(cycleDuration - 1)).hidden, false);
    assert.equal((await at(cycleDuration)).hidden, true);
    assert.equal(await page.locator("#dashboard").getAttribute("data-phase"), "background-hold");
    await prepare(page);
    assert.equal(await page.locator("#heroShow").isHidden(), true);
    assert.equal((await at(heroStart + 1500)).controls, 0);
    assert.deepEqual(page.pageErrors, []);
  } finally { await page.close(); }
});

test("HeroShow required assets fail preparation instead of showing an incomplete close-up", async () => {
  const page = await openExport(options(), page => page.route("**/assets/hero-show/images/player.png",
    route => route.fulfill({ status: 404, body: "Missing" })));
  try {
    await assert.rejects(() => prepare(page), /HeroShow|素材|图片/);
    assert.equal(await page.locator("#heroShow").isHidden(), true);
  } finally { await page.close(); }
});

test("HeroShow wipe covers the shared 16:9 presentation in portrait and 4K viewports", async () => {
  for (const o of [options(1, 390, 844), options(2, 1920, 1080)]) {
    const page = await openExport(o);
    try {
      await prepare(page, o);
      const bounds = await page.evaluate(timeMs => {
        ScoreApplication.renderFrame({ timeMs, deltaMs: 0 });
        const root = document.getElementById("heroShow").shadowRoot;
        const bridge = root.getElementById("bridge").getBoundingClientRect();
        const board = root.getElementById("board").getBoundingClientRect();
        return { x: bridge.x, y: bridge.y, width: bridge.width, height: bridge.height,
          ratio: board.width / board.height };
      }, heroStart + 380);
      const scale = Math.min(o.viewport.width / 1920, o.viewport.height / 1080);
      assert(Math.abs(bounds.x - (o.viewport.width - 1920 * scale) / 2) < 0.01);
      assert(Math.abs(bounds.y - (o.viewport.height - 1080 * scale) / 2) < 0.01);
      assert(Math.abs(bounds.width - 1920 * scale) < 0.01);
      assert(Math.abs(bounds.height - 1080 * scale) < 0.01);
      assert(Math.abs(bounds.ratio - 16 / 9) < 0.01);
      assert.deepEqual(page.pageErrors, []);
    } finally { await page.close(); }
  }
});

test("every frame in a complete cycle reproduces its Canvas PNG and DOM after reset", { timeout: Math.max(180000, cycleDuration * 4) }, async () => {
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
    assert.equal(result.count, Math.ceil(cycleDuration * 60 / 1000));
    assert.deepEqual(result.phases, ["background-hold", "entrance", "playing", "last-game-hold", "game-table-exit", "overview", "hero-show", "restart-hold"]);
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
    await advance(page, 631, 3605); // Continue pre-roll to a segment inside the leaderboard reorder.
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
      assert((await page.screenshot({ animations: "allow" })).equals(shot), "PNG screenshot changed");
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

test("required data failures reject preparation", async () => {
  for (const pattern of ["**/data/games.json"]) {
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
        .replace(/finalGameId: -1/, "finalGameId: 2");
    await route.fulfill({ response, body });
  }));
  try {
    assert.equal((await page.evaluate(() => __VIDEO_EXPORT__.getManifest())).durationMs, 16000 + heroDuration);
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
    assert.equal(await page.locator(".team-table__title").count(), 0);
    assert.equal(await page.locator("#dataPanelTitle").textContent(), "队伍排名");
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

test("normal playback still pauses the whole page, resumes, reaches overview and restarts", { timeout: 45000 }, async () => {
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
    assert((await page.screenshot({ animations: "allow" })).equals(shot), "PNG screenshot changed");
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    assert.notDeepEqual(await page.screenshot({ animations: "allow" }), shot);
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "overview");
    assert(await page.locator("#teamTableSlot").isVisible());
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "hero-show");
    await page.keyboard.press("Space");
    const heroShot = await page.screenshot({ animations: "allow" });
    await page.waitForTimeout(200);
    assert.deepEqual(await page.screenshot({ animations: "allow" }), heroShot, "space must pause the HeroShow wipe too");
    assert.equal(await page.locator("#heroShow button, #heroShow input, #heroShow select").count(), 0);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "background-hold");
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});


test("simplified NASA-punk panels retain the original title, color portraits and keyboard playback", { timeout: 30000 }, async () => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/src/config/config.js", async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/backgroundHoldDuration: 5000/, "backgroundHoldDuration: 0")
          .replace(/entranceDuration: 2000/, "entranceDuration: 0");
      await route.fulfill({ response, body });
    });
    try {
      await page.goto(baseURL);
      await page.waitForFunction(() => document.querySelector("#dashboard").dataset.phase === "playing");
      assert.equal(await page.locator("#teamLegend, #playbackToggle, .mission-patch, .panel-code, .equipment-label").count(), 0);
      assert.equal(await page.locator("#dashboardTitleText").textContent(), await page.evaluate(() => APP_CONFIG.title.text));
      assert.equal(await page.locator(".game-table__portrait").first().evaluate(node => getComputedStyle(node).filter), "saturate(0.8)");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
      assert.equal(await page.locator("body").evaluate(body => getComputedStyle(body).backgroundColor), "rgb(0, 0, 0)");
      const rects = await page.locator(".dashboard__region").evaluateAll(nodes => nodes.map(node => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      }));
      assert(rects[1].x >= rects[0].x + rects[0].width);
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#missionPhase, #missionClock").count(), 0);
      const footer = await page.evaluate(() => {
        const progress = document.getElementById("missionProgress").getBoundingClientRect();
        const game = document.getElementById("missionGame").getBoundingClientRect();
        return { height: progress.height, beforeText: progress.right <= game.left,
          sameRow: Math.abs((progress.y + progress.height / 2) - (game.y + game.height / 2)) < 1 };
      });
      assert(Math.abs(footer.height - 10 * Math.min(viewport.width / 1920, viewport.height / 1080)) < 0.01);
      assert(footer.beforeText && footer.sameRow);
      const paused = await page.screenshot({ animations: "allow" });
      await page.waitForTimeout(150);
      assert.deepEqual(await page.screenshot({ animations: "allow" }), paused);
      await page.keyboard.press("Space");

    } finally { await page.close(); }
  }
});

test("the optional legacy background is still required when enabled", async () => {
  const page = await openExport(options(), async page => {
    await page.route("**/src/config/config.js", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace("useBackgroundImage: false", "useBackgroundImage: true") });
    });
    await page.route("**/assets/images/background/paper.jpg", route => route.fulfill({ status: 404, body: "Missing" }));
  });
  try { await assert.rejects(() => prepare(page)); }
  finally { await page.close(); }
});

test("replay progress excludes every other phase, freezes at completion and resets per cycle", async () => {
  const page = await openExport();
  try {
    const cases = await page.evaluate(() => {
      return [0, 2, 47].flatMap(finalGame => [false, true].map(skipIntro => {
        const animation = { ...APP_CONFIG.animation,
          ...(skipIntro ? { backgroundHoldDuration: 0, entranceDuration: 0 } : {}) };
        const timeline = ScoreTimeline.createTimeline({ animation, finalGame, manual: true });
        const intro = animation.backgroundHoldDuration + animation.entranceDuration;
        const end = intro + (finalGame + 1) * animation.gameDuration;
        const progressAt = time => timeline.renderAt(time).replayProgress;
        return { start: progressAt(0), intro: progressAt(intro), half: progressAt((intro + end) / 2),
          end: progressAt(end), lastHold: progressAt(end + animation.gameDuration / 2),
          exit: progressAt(end + animation.gameDuration + animation.gameTableExitDuration / 2),
          overview: progressAt(end + animation.gameDuration + animation.gameTableExitDuration + 500),
          tail: progressAt(timeline.durationMs - 1), restart: progressAt(timeline.durationMs) };
      }));
    });
    for (const result of cases) assert.deepEqual(result, { start: 0, intro: 0, half: .5,
      end: 1, lastHold: 1, exit: 1, overview: 1, tail: 1, restart: 0 });
  } finally { await page.close(); }
});

test("ranking rows fill the panel and reserve a readable change column at every viewport", async () => {
  for (const [width, height] of [[1920, 1080], [1366, 768], [960, 540], [390, 844]]) {
    const o = options(1, width, height);
    const page = await openExport(o, page => page.route("**/src/config/config.js", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace(/finalGameId: -1/, "finalGameId: 2") });
    }));
    try {
      await prepare(page, o);
      await advance(page, 0, 1254); // Final ranking, after a complete short replay.
      assert.equal(await page.locator(".team-table__title").count(), 0);
      assert.equal(await page.locator("#dataPanelTitle").textContent(), "队伍排名");
      assert.equal(await page.locator("#missionProgress").getAttribute("aria-valuenow"), "100");
      assert.match(await page.locator("#missionGame").textContent(), /^03 \/ 03$/);
      const result = await page.evaluate(() => {
        const list = document.querySelector(".team-table__list").getBoundingClientRect();
        const rows = [...document.querySelectorAll(".team-table__row")];
        const details = rows.map(row => {
          const r = row.getBoundingClientRect();
          const score = row.querySelector(".team-table__score").getBoundingClientRect();
          const change = row.querySelector(".team-table__change");
          const c = change.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height,
            separate: score.right < c.left, centered: Math.abs((r.top + r.bottom) - (c.top + c.bottom)) < 1,
            contained: c.right <= r.right, readable: parseFloat(getComputedStyle(change).fontSize) >= 12 };
        });
        return { list: { top: list.top, bottom: list.bottom }, details,
          font: document.fonts.check('900 16px "Roboto Condensed"') && document.fonts.check('900 16px "Noto Sans SC"'),
          noOverflow: document.documentElement.scrollWidth === innerWidth };
      });
      assert.equal(result.details.length, 10);
      assert(Math.abs(Math.min(...result.details.map(r => r.top)) - result.list.top) < 1);
      assert(Math.abs(Math.max(...result.details.map(r => r.bottom)) - result.list.bottom) < 1);
      assert(result.details.every(r => r.separate && r.centered && r.contained && r.readable));
      assert(result.font && result.noOverflow);
      assert.deepEqual(page.pageErrors, []);
    } finally { await page.close(); }
  }
});

test("16:9 layout fits ranking names tightly and aligns full-width progress", async () => {
  for (const [width, height] of [[2560, 1440], [1920, 1080], [1600, 900], [1280, 720], [960, 540]]) {
    const o = options(1, width, height);
    const page = await openExport(o);
    try {
      await prepare(page, o);
      const failures = await page.evaluate(async () => {
        const manifest = await __VIDEO_EXPORT__.getManifest();
        const a = APP_CONFIG.animation;
        const start = manifest.durationMs - a.restartDelay - a.overviewDuration;
        const times = [
          start + a.overview.teamTableEnterDuration + 1,
          start + a.overview.teamTableEnterDuration + a.overview.initialHoldDuration + a.overview.reorderDuration / 2,
          start + a.overviewDuration - 1
        ];
        const failures = [];
        for (const timeMs of times) {
          ScoreApplication.renderFrame({ timeMs, deltaMs: 0 });
          document.querySelectorAll(".team-table__row").forEach(row => {
            const name = row.querySelector(".team-table__name");
            const score = row.querySelector(".team-table__score");
            const change = row.querySelector(".team-table__change");
            const originalScore = score.textContent;
            const originalChange = change.textContent;
            const widthBefore = score.getBoundingClientRect().width;
            for (const changeText of ["▲9", "▼9", "="]) {
              score.textContent = "-999.9";
              change.textContent = changeText;
              const n = name.getBoundingClientRect();
              const s = score.getBoundingClientRect();
              const c = change.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(name);
              const text = range.getBoundingClientRect();
              const fits = text.left >= n.left - 1 && text.right <= n.right + 1
                  && text.top >= n.top - 1 && text.bottom <= n.bottom + 1
                  && score.scrollWidth <= score.clientWidth + 1
                  && change.scrollWidth <= change.clientWidth + 1;
              const stable = Math.abs(widthBefore - s.width) < 0.1;
              const separate = n.right < s.left && s.right < c.left
                  && c.right <= row.getBoundingClientRect().right;
              if (!fits || !stable || !separate) {
                failures.push({ name: name.textContent, changeText, timeMs, fits, stable, separate });
              }
            }
            score.textContent = originalScore;
            change.textContent = originalChange;
          });
        }
        const names = [...document.querySelectorAll(".team-table__name")].map(name => {
          const range = document.createRange();
          range.selectNodeContents(name);
          const ink = range.getBoundingClientRect().width;
          return { ink, spare: name.getBoundingClientRect().width - ink };
        }).sort((a, b) => b.ink - a.ink);
        if (names[0].spare > 6) failures.push({ extraNameSpace: names[0].spare });
        const chart = document.querySelector(".chart-instrument").getBoundingClientRect();
        const table = document.querySelector(".table-instrument").getBoundingClientRect();
        const footer = document.querySelector(".telemetry").getBoundingClientRect();
        if (Math.abs(footer.left - chart.left) > 1 || Math.abs(footer.right - table.right) > 1) {
          failures.push({ footerAlignment: false });
        }
        if (getComputedStyle(document.querySelector(".mission-progress"), "::after").content !== "none") {
          failures.push({ bottomTicksPresent: true });
        }
        return failures;
      });
      assert.deepEqual(failures, [], `ranking content clipped at ${width}×${height}`);
      assert.deepEqual(page.pageErrors, []);
    } finally { await page.close(); }
  }
});

test("progress is centered in the frame and ticks adapt to whole-game subdivisions", async () => {
  const source = JSON.parse(await readFile(path.join(root, "data/games.json"), "utf8"));
  for (const [width, height, count] of [[1920, 1080, 3], [1920, 1080, 32], [1920, 1080, 512], [1280, 720, 3], [1280, 720, 512]]) {
    const o = options(1, width, height);
    const games = Array.from({ length: count }, (_, index) => ({ ...source.games[index % source.games.length], gameId: index }));
    const page = await openExport(o, page => page.route("**/data/games.json", route =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ games }) })));
    try {
      await prepare(page, o);
      const result = await page.evaluate(async count => {
        const bar = document.getElementById("missionProgress");
        const style = getComputedStyle(bar);
        const rect = bar.getBoundingClientRect();
        const contentWidth = bar.clientWidth - ["paddingLeft", "paddingRight"]
            .reduce((sum, property) => sum + parseFloat(style[property]), 0);
        const spacing = parseFloat(style.getPropertyValue("--progress-tick-spacing"));
        const gamesPerTick = Number(bar.dataset.gamesPerTick);
        const panel = document.querySelector(".table-instrument").getBoundingClientRect();
        const presentation = document.getElementById("presentation");
        const scale = Number(presentation.style.getPropertyValue("--presentation-scale"));
        const frameBottom = presentation.getBoundingClientRect().bottom
            - parseFloat(getComputedStyle(presentation, "::before").bottom) * scale;
        const topGap = rect.top - panel.bottom;
        const bottomGap = frameBottom - rect.bottom;
        const initialWidth = rect.width;
        const manifest = await __VIDEO_EXPORT__.getManifest();
        ScoreApplication.renderFrame({ timeMs: manifest.durationMs - 1, deltaMs: 0 });
        return { spacing, gamesPerTick, expectedSpacing: contentWidth / count * gamesPerTick,
          topGap, bottomGap, stableWidth: Math.abs(bar.getBoundingClientRect().width - initialWidth) < 0.1,
          background: style.backgroundImage, filledBackground: getComputedStyle(bar.firstElementChild).backgroundImage,
          topMargin: APP_CONFIG.layout.pageMargin.top, titleHeight: APP_CONFIG.layout.rows.title };
      }, count);
      assert(result.spacing >= 12 && result.spacing <= 24);
      assert(Math.abs(result.spacing - result.expectedSpacing) < 0.001);
      assert(Math.abs(Math.log2(result.gamesPerTick) - Math.round(Math.log2(result.gamesPerTick))) < 0.001);
      if (count === 512) assert(result.gamesPerTick > 1, "crowded ticks should be halved");
      else assert(result.gamesPerTick < 1, "sparse ticks should be subdivided");
      assert(Math.abs(result.topGap - result.bottomGap) < 1, "progress should sit midway between panel and frame");
      assert(result.topGap > 0 && result.stableWidth);
      const stops = background => [...background.matchAll(/(-?[\d.]+)px/g)].map(match => Number(match[1]));
      assert(Math.abs(stops(result.background).at(-1) - result.spacing) < 0.001);
      assert.deepEqual(stops(result.background), stops(result.filledBackground));
      assert.equal(result.topMargin, 0.025);
      assert.equal(result.titleHeight, 0.145);
      assert.deepEqual(page.pageErrors, []);
    } finally { await page.close(); }
  }
});

test("export preparation rejects a missing title font", async () => {
  const page = await openExport(options(), page => page.route("**/assets/font/RobotoCondensed-Variable.ttf", route =>
    route.fulfill({ status: 404, body: "Missing" })));
  try { await assert.rejects(() => prepare(page)); }
  finally { await page.close(); }
});

test("opening keeps the chassis visible and fades the first table together with the chart", async () => {
  const page=await openExport();
  try {
    await prepare(page);
    for (const time of [0, 2500, 4999, 6000, 7000]) {
      const state=await page.evaluate(time=>{
        ScoreApplication.renderFrame({timeMs:time,deltaMs:0});
        return {
          title:getComputedStyle(document.querySelector('h1')).visibility,
          titleWeight:getComputedStyle(document.querySelector('h1')).fontWeight,
          titleOpacity:getComputedStyle(document.querySelector('h1')).opacity,
          panel:getComputedStyle(document.querySelector('.dashboard__region')).visibility,
          header:getComputedStyle(document.querySelector('.panel-header')).visibility,
          table:getComputedStyle(document.querySelector('.table-stage')).visibility,
          chartOpacity:Number(getComputedStyle(document.querySelector('#scoreChart')).opacity),
          tableOpacity:Number(getComputedStyle(document.querySelector('#gameTable')).opacity),
          rows:[...document.querySelectorAll('#gameTable .game-table__row')].map(row=>({opacity:row.style.opacity,transform:row.style.transform})),
          progress:document.querySelector('#missionProgress').getAttribute('aria-valuenow')
        };
      },time);
      assert.equal(state.title,'visible');
      assert.equal(state.titleOpacity,'1');
      assert.equal(state.titleWeight,'900');
      assert.equal(state.panel,'visible');
      assert.equal(state.header,'visible');
      assert.equal(state.table,time<5000?'hidden':'visible');
      assert.equal(state.tableOpacity,state.chartOpacity);
      if(time>=5000) {
        assert.equal(state.rows.length,8);
        assert(state.rows.every(row=>row.opacity==='1' && row.transform==='none'));
      }
      assert.equal(state.chartOpacity,time<5000?0:time<7000?.5:1);
      assert.equal(state.progress,'0');
    }
    const later=await page.evaluate(()=>{
      const config=APP_CONFIG.gameTable;
      const time=7000+2*APP_CONFIG.animation.gameDuration+config.rowTransitionDuration+config.rowTransitionDelay*7+config.rowTransitionDuration/2;
      ScoreApplication.renderFrame({timeMs:time,deltaMs:0});
      return [...document.querySelectorAll('#gameTable .game-table__row')].map(row=>row.style.transform);
    });
    assert(later.some(transform=>/^translateX\([1-9]/.test(transform)),'later games should still slide in');
    const restarted=await page.evaluate(()=>{
      ScoreApplication.reset();
      ScoreApplication.renderFrame({timeMs:6000,deltaMs:0});
      return {opacity:document.querySelector('#gameTable').style.opacity,
        stationary:[...document.querySelectorAll('#gameTable .game-table__row')].every(row=>row.style.transform==='none')};
    });
    assert.deepEqual(restarted,{opacity:'0.5',stationary:true});
  } finally {await page.close();}
});

test("fractional pixel ratios clear edge remnants and keep all dates inside the canvas", {timeout:60000}, async () => {
  for(const [width,height,scale] of [[2239,1399,1.25],[1593,996,1.5],[1366,768,1.25],[997,625,1.5]]) {
    const o=options(scale,width,height);
    o.output={width:Math.round(width*scale),height:Math.round(height*scale)};
    const page=await openExport(o);
    try {
      await prepare(page,o);
      const result=await page.evaluate(()=>{
        const canvas=document.querySelector('#scoreChart');
        const context=canvas.getContext('2d');
        const original=context.fillText;
        const outside=[];
        context.fillText=function(text,x,y,...args){
          if(this.textBaseline==='top') {
            const half=this.measureText(text).width/2;
            if(x-half<1.9 || x+half>canvas.clientWidth-1.9) outside.push({text,x,half});
          }
          return original.call(this,text,x,y,...args);
        };
        const dirtyEdge=target=>{
          const ctx=target.getContext('2d');ctx.save();ctx.resetTransform();
          ctx.fillStyle='#ff0000';ctx.fillRect(target.width-1,0,1,4);ctx.restore();
        };
        let clean=true;
        for(let t=7000;t<79000;t+=375) {
          dirtyEdge(canvas);createdCanvases.forEach(dirtyEdge);
          ScoreApplication.renderFrame({timeMs:t,deltaMs:375});
          for(const target of [canvas,...createdCanvases]) {
            const pixels=target.getContext('2d').getImageData(target.width-1,0,1,4).data;
            for(let index=3;index<pixels.length;index+=4) if(pixels[index]!==0) clean=false;
          }
        }
        return {outside,clean};
      });
      assert.deepEqual(result.outside,[]);
      assert(result.clean,'previous content remained at the physical canvas edge');
      assert.deepEqual(page.pageErrors,[]);
    } finally {await page.close();}
  }
});

test("the ranking list leaves the bottom decorative pin unobstructed", async () => {
  for(const [width,height] of [[2239,1399],[1920,1080],[1366,768],[960,540],[390,844]]) {
    const o=options(1,width,height);
    const page=await openExport(o);
    try {
      await prepare(page,o);
      const gap=await page.evaluate(()=>{
        ScoreApplication.renderFrame({timeMs:86000,deltaMs:100});
        const panel=document.querySelector('.table-instrument').getBoundingClientRect();
        const bottom=Math.max(...[...document.querySelectorAll('.team-table__row')].map(n=>n.getBoundingClientRect().bottom));
        const pin=getComputedStyle(document.querySelector('.table-instrument'),'::after');
        const scale=Number(document.getElementById('presentation').style.getPropertyValue('--presentation-scale'));
        const pinTop=panel.bottom-(1+parseFloat(pin.bottom)+parseFloat(pin.height))*scale;
        return (pinTop-bottom)/scale;
      });
      assert(gap>=5,'the last team row overlaps the bottom pin');
    } finally {await page.close();}
  }
});
