const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { inflateSync } = require("node:zlib");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
let server, browser, baseURL;
before(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(root + path.sep)) throw Error("Invalid path");
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseURL = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
});
after(async () => {
  await browser?.close();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
});

async function exportPage(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { globalThis.__VIDEO_EXPORT_REQUEST__ = {}; });
  await page.goto(baseURL);
  const options = { fps: 60, viewport, output: viewport, deviceScaleFactor: 1, seed: 42 };
  await page.evaluate(options => __VIDEO_EXPORT__.prepare(options), options);
  await page.evaluate(() => __VIDEO_EXPORT__.reset());
  return { page, errors };
}

function near(actual, expected, tolerance = 0.1) {
  assert(Math.abs(actual - expected) < tolerance, actual + " != " + expected);
}

// A 1×1 PNG has no nonzero left/above predictors for any PNG filter.
async function blackPixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  assert.equal(png[24], 8);
  assert([2, 6].includes(png[25]));
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  assert.deepEqual([...inflateSync(Buffer.concat(chunks)).subarray(1, 4)], [0, 0, 0]);
}

test("the first visible frame already has the final chart/table widths, even with slow data", async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/data/teams.json", async route => { await gate; await route.continue(); });
  await page.addInitScript(() => {
    globalThis.visibleLayouts = [];
    function sample() {
      const stage = document.getElementById("presentation");
      if (stage && getComputedStyle(stage).visibility === "visible") {
        visibleLayouts.push([
          document.querySelector(".chart-instrument").offsetWidth,
          document.querySelector(".table-instrument").offsetWidth,
          document.getElementById("dashboardTitleText").textContent
        ]);
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(120);
    assert.equal(await page.locator("#presentation").evaluate(node => getComputedStyle(node).visibility), "hidden");
    assert.equal(await page.locator("body").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(0, 0, 0)");
    release();
    await page.waitForSelector(".presentation--ready");
    await page.waitForFunction(() => visibleLayouts.length >= 8);
    const samples = await page.evaluate(() => visibleLayouts);
    assert(samples[0][2].length > 0);
    assert(samples.every(value => JSON.stringify(value) === JSON.stringify(samples[0])), JSON.stringify(samples));
    await page.keyboard.press("Space");
    const before = await page.screenshot();
    await page.waitForTimeout(100);
    assert.deepEqual(await page.screenshot(), before);
  } finally { release(); await page.close(); }
});

test("all replay phases and HeroShow stay inside a centered 16:9 frame with pure black bars", async () => {
  for (const viewport of [
    { width: 1600, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1080 },
    { width: 1024, height: 768 }, { width: 390, height: 844 },
    { width: 844, height: 390 }, { width: 3840, height: 2160 }
  ]) {
    const { page, errors } = await exportPage(viewport);
    try {
      const times = await page.evaluate(async () => {
        const manifest = await __VIDEO_EXPORT__.getManifest();
        const a = APP_CONFIG.animation;
        const count = Number(document.getElementById("missionGameTotal").textContent);
        const overview = a.backgroundHoldDuration + a.entranceDuration + (count + 1) * a.gameDuration + a.gameTableExitDuration;
        const hero = overview + a.overviewDuration;
        return [0, a.backgroundHoldDuration + a.entranceDuration + 1, overview + a.overviewDuration - 1, hero + 400, hero + 760, hero + 3000, manifest.durationMs - 1, manifest.durationMs];
      });
      const scale = Math.min(viewport.width / 1600, viewport.height / 900);
      const expected = { width: 1600 * scale, height: 900 * scale };
      const x = (viewport.width - expected.width) / 2, y = (viewport.height - expected.height) / 2;
      let columns;
      for (const timeMs of times) {
        const state = await page.evaluate(timeMs => {
          ScoreApplication.renderFrame({ timeMs, deltaMs: 0 });
          const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
          const host = document.getElementById("heroShow");
          return {
            frame: rect(document.getElementById("presentation")),
            columns: [...document.querySelectorAll(".dashboard__region")].map(node => node.offsetWidth),
            chart: rect(document.querySelector(".chart-instrument")),
            table: rect(document.querySelector(".table-instrument")),
            hero: host.hidden ? null : rect(host.shadowRoot.getElementById("viewport")),
            canvas: { width: scoreChart.width, logical: scoreChart.clientWidth },
            viewport: [document.documentElement.scrollWidth, document.documentElement.scrollHeight]
          };
        }, timeMs);
        near(state.frame.x, x); near(state.frame.y, y);
        near(state.frame.width, expected.width); near(state.frame.height, expected.height);
        assert(state.table.x >= state.chart.x + state.chart.width);
        columns ??= state.columns;
        assert.deepEqual(state.columns, columns);
        assert.deepEqual(state.viewport, [viewport.width, viewport.height]);
        assert.equal(state.canvas.width, Math.round(state.canvas.logical * scale));
        if (state.hero) assert.deepEqual(state.hero, state.frame);
        if (x >= 2) {
          await blackPixel(page, 0, Math.floor(viewport.height / 2));
          await blackPixel(page, viewport.width - 1, Math.floor(viewport.height / 2));
        }
        if (y >= 2) {
          await blackPixel(page, Math.floor(viewport.width / 2), 0);
          await blackPixel(page, Math.floor(viewport.width / 2), viewport.height - 1);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
});

test("close-up centers its photo before adding 30px, centers its name, keeps placements together and uses a black first rank", async () => {
  const expectedLines = JSON.parse(await readFile(path.join(root, "data/months/2026-10/month.json"), "utf8")).hero.content.teamName;
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    const { page, errors } = await exportPage(viewport);
    try {
      const result = await page.evaluate(async () => {
        const manifest = await __VIDEO_EXPORT__.getManifest();
        const a = APP_CONFIG.animation;
        const count = Number(document.getElementById("missionGameTotal").textContent);
        const overviewEnd = a.backgroundHoldDuration + a.entranceDuration + (count + 1) * a.gameDuration + a.gameTableExitDuration + a.overviewDuration;
        ScoreApplication.renderFrame({ timeMs: overviewEnd - 1, deltaMs: 0 });
        const rankColor = getComputedStyle(document.querySelector(".team-table__rank--first")).color;
        ScoreApplication.renderFrame({ timeMs: manifest.durationMs - 3001, deltaMs: 0 });
        const root = document.getElementById("heroShow").shadowRoot;
        const center = (selector, axis) => {
          const rect = root.querySelector(selector).getBoundingClientRect();
          return axis === "x" ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
        };
        const value = root.querySelector(".metric--placements .metric-number");
        const groups = [...value.children];
        const ten = groups.find(node => node.textContent === "10");
        const digitGap = ten.children[1].getBoundingClientRect().left - ten.children[0].getBoundingClientRect().right;
        const gaps = groups.slice(1).map((node, i) => node.getBoundingClientRect().left - groups[i].getBoundingClientRect().right);
        return {
          photoCenter: center("#portrait", "x"), panelCenter: center(".photo-panel", "x"),
          scale: root.getElementById("stage").getBoundingClientRect().width / 1920, rankColor,
          nameCenter: center(".team-name", "y"), logoCenter: center(".identity", "y"),
          lines: [...root.querySelectorAll(".name-line")].map(node => node.textContent),
          placements: groups.map(node => node.textContent), digitGap, gaps,
        };
      });
      near(result.photoCenter - result.panelCenter, 30 * result.scale);
      assert.equal(result.rankColor, "rgb(0, 0, 0)");
      near(result.nameCenter, result.logoCenter);
      assert.deepEqual(result.lines, expectedLines);
      assert.deepEqual(result.placements, ["9", "-", "10", "-", "3", "-", "8"]);
      near(result.digitGap, 0);
      assert(result.gaps.every(gap => gap > 0));
      result.gaps.forEach(gap => near(gap, result.gaps[0]));
      assert.deepEqual(errors, []);
      if (viewport.width === 1920) await page.screenshot({ path: path.join(root, "test-results/hero-october-updated.png") });
    } finally { await page.close(); }
  }
});

test("resizing normal playback only scales the design, and background images never paint the bars", async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route("**/src/config/config.js", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("useBackgroundImage: false", "useBackgroundImage: true") });
  });
  try {
    await page.goto(baseURL);
    await page.waitForSelector(".presentation--ready");
    await page.keyboard.press("Space");
    const original = await page.locator(".dashboard__region").evaluateAll(nodes => nodes.map(node => [node.offsetWidth, node.offsetHeight]));
    for (const viewport of [{ width: 390, height: 844 }, { width: 2560, height: 1080 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport);
      const scale = Math.min(viewport.width / 1600, viewport.height / 900);
      await page.waitForFunction(scale => Math.abs(Number(document.getElementById("presentation").style.getPropertyValue("--presentation-scale")) - scale) < 0.00001, scale);
      assert.deepEqual(await page.locator(".dashboard__region").evaluateAll(nodes => nodes.map(node => [node.offsetWidth, node.offsetHeight])), original);
      await blackPixel(page, 0, 0);
    }
  } finally { await page.close(); }
});
