const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");
const baseUrl = "https://example.test/ScoreFlow/";
const file = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

function fixture(overrides = {}) {
  const requests = [];
  const context = vm.createContext({ URL, structuredClone });
  for (const name of ["team-data", "game-data", "month-data"]) {
    vm.runInContext(fs.readFileSync(path.join(root, `src/data/${name}.js`), "utf8"), context);
  }
  const load = () => context.MonthData.load({ baseUrl, fetcher: async (url, options) => {
    assert.equal(options.cache, "no-store");
    const relative = url.slice(baseUrl.length);
    requests.push(relative);
    const value = Object.hasOwn(overrides, relative) ? overrides[relative] : file(relative);
    return { ok: value !== undefined, status: value === undefined ? 404 : 200, json: async () => structuredClone(value) };
  } });
  return { load, requests };
}

test("October uses its stored opening scores and games while the entire close-up falls back to September", async () => {
  const { load, requests } = fixture();
  const result = await load();
  assert.equal(result.month, "2026-10");
  assert.equal(result.heroMonth, "2026-09");
  assert.match(result.chart.title, /10月/);
  assert.equal(result.chart.initialText, "10/1");
  assert.equal(result.chart.finalText, "10/31");
  assert.match(result.gameData.games[0].info, /^10月/);
  assert.equal(result.hero.content.label, "九月队伍积分冠军");
  assert.equal(result.hero.content.score, "+197.2");
  assert.equal(result.heroTeam.heroColor, "#EF92AE");
  assert.equal(result.hero.assets.portrait, baseUrl + "data/months/2026-09/assets/portrait.png");
  assert.equal(result.hero.assets.logo, baseUrl + "data/months/2026-09/assets/logo.png");
  assert(!requests.includes("data/months/2026-09/games.json"), "loading October must not derive scores from September games");
  for (const team of result.teamData.teams) {
    assert.equal(team.initialScore, file("data/months/2026-10/month.json").initialScores[team.name]);
  }
});

test("September selects September content with a zero opening-score snapshot", async () => {
  const { load, requests } = fixture({ "data/active-month.json": { month: "2026-09", availableMonths: ["2026-10", "2026-09"] } });
  const result = await load();
  assert.equal(result.heroMonth, "2026-09");
  assert.match(result.chart.title, /9月/);
  assert.match(result.gameData.games[0].info, /^9月/);
  assert(result.teamData.teams.every(team => team.initialScore === 0));
  assert(!requests.some(url => url.includes("2026-10/")), "future months must never supply the close-up");
});

test("a configured October close-up is preferred and all month-relative assets resolve under a deployment subpath", async () => {
  const october = file("data/months/2026-10/month.json");
  october.hero = file("data/months/2026-09/month.json").hero;
  october.hero.team = "EX风林火山";
  october.hero.content.label = "十月队伍积分冠军";
  const { load, requests } = fixture({ "data/months/2026-10/month.json": october });
  const result = await load();
  assert.equal(result.heroMonth, "2026-10");
  assert.equal(result.heroTeam.name, "EX风林火山");
  assert.equal(result.hero.assets.portrait, baseUrl + "data/months/2026-10/assets/portrait.png");
  assert(!requests.some(url => url.includes("2026-09/")));
});

test("fallback skips several unconfigured months in chronological order regardless of registry order", async () => {
  const november = file("data/months/2026-10/month.json");
  november.month = "2026-11";
  const { load, requests } = fixture({
    "data/active-month.json": { month: "2026-11", availableMonths: ["2026-10", "2026-09", "2026-11", "2026-12"] },
    "data/months/2026-11/month.json": november,
    "data/months/2026-11/games.json": file("data/months/2026-10/games.json")
  });
  assert.equal((await load()).heroMonth, "2026-09");
  assert(requests.indexOf("data/months/2026-10/month.json") < requests.indexOf("data/months/2026-09/month.json"));
  assert(!requests.some(url => url.includes("2026-12/")));
});

test("no close-up, broken month files, incomplete snapshots and malformed close-ups fail explicitly", async () => {
  const september = file("data/months/2026-09/month.json");
  september.hero = null;
  await assert.rejects(fixture({ "data/months/2026-09/month.json": september }).load, /均未配置特写/);
  await assert.rejects(fixture({ "data/months/2026-09/month.json": undefined }).load, /HTTP 404/);
  for (const invalid of [false, { team: "角川樱花骑士" }]) {
    const october = file("data/months/2026-10/month.json");
    october.hero = invalid;
    await assert.rejects(fixture({ "data/months/2026-10/month.json": october }).load, /hero/);
  }
  const october = file("data/months/2026-10/month.json");
  delete october.initialScores["EX风林火山"];
  await assert.rejects(fixture({ "data/months/2026-10/month.json": october }).load, /initialScores/);
  const empty = { month: "2026-10", availableMonths: ["2026-09"] };
  await assert.rejects(fixture({ "data/active-month.json": empty }).load, /active-month/);
});

test("omitting the close-up also falls back, while a null selection produces a configuration error", async () => {
  const october = file("data/months/2026-10/month.json");
  delete october.hero;
  assert.equal((await fixture({ "data/months/2026-10/month.json": october }).load()).heroMonth, "2026-09");
  await assert.rejects(fixture({ "data/active-month.json": null }).load, /active-month/);
});

test("heroColor overrides chart color; omitted heroColor uses chart color and shared transforms change the whole palette", async () => {
  const { createTeamTheme } = await import(pathToFileURL(path.join(root, "src/hero-show/theme.js")));
  const { SHOW_DEFAULTS } = await import(pathToFileURL(path.join(root, "src/hero-show/show-config.js")));
  const make = team => createTeamTheme(SHOW_DEFAULTS.theme, team, SHOW_DEFAULTS.teamColorTransforms);
  const pink = make({ color: "#000000", heroColor: "#EF92AE" });
  assert.equal(pink.accent, "#EF92AE");
  const blue = make({ color: "#3754a8" });
  assert.equal(blue.accent, "#3754a8");
  for (const key of ["panel", "panelLight", "panelGlow"]) {
    assert.notEqual(blue[key], pink[key]);
    assert(blue[key].includes("#3754a8"));
  }
  assert.equal(blue.paper, pink.paper);
  assert.throws(() => make({ color: "#3754a8", heroColor: "" }), /heroColor/);
  assert.throws(() => createTeamTheme({}, { color: "#3754a8" }, { panel: { amount: 2, mix: "#FFF" } }), /变换/);
});
