(function startApplication() {
  "use strict";

  const { animation, backgroundColor, debug, teamsDataUrl, layout, gamesDataUrl } = APP_CONFIG;

  // 将布局比例转换为 CSS 百分比
  function percentage(value, name) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`${name} 必须是大于 0 且小于 1 的数字`);
    }
    return `${value * 100}%`;
  }

  // 将相对于整个页面的宽度比例作为网格权重
  function fraction(value, name) {
    percentage(value, name);
    return `${value}fr`;
  }

  // 校验并将页面外观配置写入样式表
  function applyAppearance() {
    if (!CSS.supports("color", backgroundColor)) {
      throw new Error(`背景颜色“${backgroundColor}”无效`);
    }
    document.documentElement.style.setProperty("--background-color", backgroundColor);
  }

  // 校验配置并把布局参数写入页面
  function applyLayout() {
    const dashboard = document.getElementById("dashboard");
    const { pageMargin, rows, chartColumns } = layout;
    const verticalTotal = pageMargin.vertical * 2 + rows.title + rows.chart + rows.footerDecoration;
    const horizontalTotal = pageMargin.horizontal * 2
        + chartColumns.scoreChart + chartColumns.decoration + chartColumns.dataTable;
    if (Math.abs(verticalTotal - 1) > Number.EPSILON * 10) {
      throw new Error("layout 的纵向比例之和必须为 1");
    }
    if (Math.abs(horizontalTotal - 1) > Number.EPSILON * 10) {
      throw new Error("layout 的水平比例之和必须为 1");
    }

    const variables = {
      "--page-horizontal-margin": [pageMargin.horizontal, "layout.pageMargin.horizontal"],
      "--page-vertical-margin": [pageMargin.vertical, "layout.pageMargin.vertical"],
      "--title-height": [rows.title, "layout.rows.title"],
      "--chart-height": [rows.chart, "layout.rows.chart"],
      "--footer-decoration-height": [rows.footerDecoration, "layout.rows.footerDecoration"]
    };
    Object.entries(variables).forEach(([property, [value, name]]) => {
      dashboard.style.setProperty(property, percentage(value, name));
    });
    dashboard.style.setProperty(
        "--score-chart-width", fraction(chartColumns.scoreChart, "layout.chartColumns.scoreChart")
    );
    dashboard.style.setProperty(
        "--middle-decoration-width", fraction(chartColumns.decoration, "layout.chartColumns.decoration")
    );
    dashboard.style.setProperty(
        "--data-table-width", fraction(chartColumns.dataTable, "layout.chartColumns.dataTable")
    );
  }

  // 调试时保留从 game0 到指定 gameId 的数据，并同步截断各队积分序列。
  function limitDataForDebug(data) {
    const { finalGameId } = debug;
    if (finalGameId === -1) return data;
    if (!Number.isInteger(finalGameId) || finalGameId <= 0 || finalGameId >= data.games.length) {
      throw new Error(`debug.finalGameId 必须是 -1，或大于 0 且小于 ${data.games.length} 的整数`);
    }

    const length = finalGameId + 1;
    return Object.freeze({
      games: Object.freeze(data.games.slice(0, length)),
      teams: Object.freeze(data.teams.map(team => Object.freeze({
        ...team,
        values: Object.freeze(team.values.slice(0, length))
      })))
    });
  }

  // 加载数据并装配图表与公共时间轴
  async function start() {
    try {
      applyAppearance();
      applyLayout();
      const [teamsResponse, gamesResponse] = await Promise.all([
        fetch(teamsDataUrl, { cache: "no-store" }),
        fetch(gamesDataUrl, { cache: "no-store" })
      ]);
      if (!teamsResponse.ok) {
        throw new Error(`读取 ${teamsDataUrl} 失败（HTTP ${teamsResponse.status}）`);
      }
      if (!gamesResponse.ok) {
        throw new Error(`读取 ${gamesDataUrl} 失败（HTTP ${gamesResponse.status}）`);
      }

      const teamData = TeamData.parseTeamsJson(await teamsResponse.text());
      const gameData = GameData.parseGamesJson(await gamesResponse.text());
      const completeData = TeamData.combineWithGames(teamData, gameData);
      const data = limitDataForDebug(completeData);
      // 在绘图前验证所有队伍颜色
      data.teams.forEach((team, index) => {
        if (!CSS.supports("color", team.color)) {
          throw new Error(`第 ${index + 1} 支队伍的 color“${team.color}”无效`);
        }
      });

      const finalGame = data.games.length - 1;
      const chart = ScoreChart.createScoreChart(
          document.getElementById("scoreChart"), data.teams, finalGame, APP_CONFIG
      );
      const gameTable = GameTable.createGameTable(
          document.getElementById("gameTable"),
          document.getElementById("teamTableSlot"),
          data.games,
          APP_CONFIG.gameTable
      );
      const teamTable = TeamTable.createTeamTable(
          document.getElementById("teamTableSlot"), data.teams, APP_CONFIG.teamTable
      );
      const timeline = ScoreTimeline.createTimeline({ animation, finalGame });
      // 使用同一时间状态驱动折线图和比赛详情
      timeline.subscribe(chart.render);
      timeline.subscribe(gameTable.render);
      timeline.subscribe(teamTable.render);
      timeline.start();
    } catch (error) {
      // 将初始化错误同时展示给用户和开发者
      const message = error instanceof Error ? error.message : String(error);
      const errorElement = document.getElementById("dataError");
      errorElement.textContent = `无法加载页面数据：${message}`;
      errorElement.hidden = false;
      console.error(error);
    }
  }

  start();
}());
