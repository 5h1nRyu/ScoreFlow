(function exposeMonthData(global) {
  "use strict";

  const isMonth = value => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  function string(value, path) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${path} 必须是非空字符串`);
  }
  function validateMonth(source, month) {
    if (!source || source.month !== month) throw new Error(`月份配置 ${month} 的 month 不匹配`);
    for (const key of ["title", "initialText", "finalText"]) string(source.chart?.[key], `${month}.chart.${key}`);
    if (!source.initialScores || typeof source.initialScores !== "object" || Array.isArray(source.initialScores)) {
      throw new Error(`${month}.initialScores 必须是月初积分快照`);
    }
    if (source.hero != null) {
      if (!source.hero || typeof source.hero !== "object" || Array.isArray(source.hero)) {
        throw new Error(`${month}.hero 必须是特写对象，未配置时可省略或设为 null`);
      }
      string(source.hero.team, `${month}.hero.team`);
      for (const key of ["label", "teamName", "scoreLabel", "score", "unit", "metricsNote"]) {
        if (typeof source.hero.content?.[key] !== "string") throw new Error(`${month}.hero.content.${key} 必须是字符串`);
      }
      if (!Array.isArray(source.hero.content.metrics)) throw new Error(`${month}.hero.content.metrics 必须是数组`);
      source.hero.content.metrics.forEach((metric, i) => {
        if (!metric || typeof metric !== "object" || Array.isArray(metric)) throw new Error(`${month}.hero.content.metrics[${i}] 必须是对象`);
        for (const key of ["label", "value", "unit"]) {
          if (typeof metric[key] !== "string") throw new Error(`${month}.hero.content.metrics[${i}].${key} 必须是字符串`);
        }
      });
      for (const key of ["portrait", "logo"]) {
        if (typeof source.hero.assets?.[key] !== "string") throw new Error(`${month}.hero.assets.${key} 必须是路径字符串（可留空）`);
      }
    }
    return source;
  }

  async function load({ baseUrl, signal, fetcher = global.fetch.bind(global) }) {
    async function json(relative, base = baseUrl) {
      const url = new URL(relative, base).href;
      const response = await fetcher(url, { cache: "no-store", signal });
      if (!response.ok) throw new Error(`读取 ${url} 失败（HTTP ${response.status}）`);
      try { return await response.json(); }
      catch (error) { throw new Error(`${url} 不是有效 JSON：${error.message}`); }
    }
    const selection = await json("data/active-month.json");
    if (!isMonth(selection?.month) || !Array.isArray(selection.availableMonths)
        || !selection.availableMonths.every(isMonth)
        || new Set(selection.availableMonths).size !== selection.availableMonths.length
        || !selection.availableMonths.includes(selection.month)) {
      throw new Error("active-month.json 必须配置有效的 month 及无重复的 availableMonths，且包含当前月份");
    }
    const monthUrl = month => new URL(`data/months/${month}/month.json`, baseUrl).href;
    const [selected, teamsSource, gamesSource] = await Promise.all([
      json(monthUrl(selection.month)).then(source => validateMonth(source, selection.month)),
      json("data/teams.json"),
      json(`data/months/${selection.month}/games.json`)
    ]);
    // 月初积分始终来自选定月份，回溯特写不读取历史比赛、不推导积分。
    const teamData = global.TeamData.parseTeamsJson(JSON.stringify(teamsSource), selected.initialScores);
    const gameData = global.GameData.parseGamesJson(JSON.stringify(gamesSource));
    let heroMonth, hero;
    for (const month of selection.availableMonths.filter(month => month <= selection.month).sort().reverse()) {
      const source = month === selection.month ? selected : validateMonth(await json(monthUrl(month)), month);
      if (source.hero == null) continue;
      heroMonth = month;
      hero = structuredClone(source.hero);
      for (const key of ["portrait", "logo"]) {
        if (hero.assets[key]) hero.assets[key] = new URL(hero.assets[key], monthUrl(month)).href;
      }
      break;
    }
    if (!hero) throw new Error(`${selection.month} 及已登记的更早月份均未配置特写`);
    const heroTeam = teamData.teams.find(team => team.name === hero.team);
    if (!heroTeam) throw new Error(`特写队伍“${hero.team}”不在 teams.json 中`);
    return { month: selection.month, heroMonth, chart: selected.chart, teamData, gameData, hero, heroTeam };
  }
  global.MonthData = Object.freeze({ load });
}(globalThis));
