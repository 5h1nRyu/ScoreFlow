(function startApplication() {
  "use strict";

  const { animation, backgroundColor, debug, teamsDataUrl, layout, gamesDataUrl, title } = APP_CONFIG;

  // 将布局比例转换为 CSS 百分比
  function percentage(value, name) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`${name} 必须是大于 0 且小于 1 的数字`);
    }
    return `${value * 100}%`;
  }

  // 将标题内部的宽度比例作为网格权重
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
    if (typeof debug.showLayoutBorders !== "boolean") {
      throw new Error("debug.showLayoutBorders 必须是布尔值");
    }
    document.getElementById("dashboard").classList.toggle(
        "dashboard--debug-layout", debug.showLayoutBorders
    );
  }

  // 校验配置并把布局参数写入页面
  function applyLayout() {
    const dashboard = document.getElementById("dashboard");
    const { pageMargin, rows, chartColumns } = layout;
    const verticalTotal = pageMargin.top + rows.title + rows.chart + pageMargin.bottom;
    const titleColumnsTotal = title.columns.icon1 + title.columns.text + title.columns.icon2;
    if (Math.abs(verticalTotal - 1) > Number.EPSILON * 10) {
      throw new Error("layout 的纵向比例之和必须为 1");
    }
    // 两个表格不会同时占列，分别校验各自的布局，边距仅扣除一次。
    ["gameTable", "teamTable"].forEach(name => {
      percentage(chartColumns[name], `layout.chartColumns.${name}`);
      const scoreChart = 1 - pageMargin.horizontal * 2 - chartColumns[name];
      percentage(scoreChart, `layout.chartColumns.${name} 对应的剩余折线图比例`);
    });
    if (Math.abs(titleColumnsTotal - 1) > Number.EPSILON * 10) {
      throw new Error("title.columns 的比例之和必须为 1");
    }
    if (!Number.isFinite(title.fontSize) || title.fontSize <= 0) {
      throw new Error("title.fontSize 必须是大于 0 的数字");
    }
    if (typeof title.text !== "string" || title.text.length === 0) {
      throw new Error("title.text 必须是非空字符串");
    }
    const variables = {
      "--page-horizontal-margin": [pageMargin.horizontal, "layout.pageMargin.horizontal"],
      "--page-top-margin": [pageMargin.top, "layout.pageMargin.top"],
      "--page-bottom-margin": [pageMargin.bottom, "layout.pageMargin.bottom"],
      "--title-height": [rows.title, "layout.rows.title"],
      "--chart-height": [rows.chart, "layout.rows.chart"]
    };
    Object.entries(variables).forEach(([property, [value, name]]) => {
      dashboard.style.setProperty(property, percentage(value, name));
    });
    renderTableLayout({ tableLayoutProgress: 0 });
    dashboard.style.setProperty(
        "--title-icon-1-width", fraction(title.columns.icon1, "title.columns.icon1")
    );
    dashboard.style.setProperty(
        "--title-text-width", fraction(title.columns.text, "title.columns.text")
    );
    dashboard.style.setProperty(
        "--title-icon-2-width", fraction(title.columns.icon2, "title.columns.icon2")
    );
    dashboard.style.setProperty("--title-font-size", `${title.fontSize}px`);
    document.getElementById("dashboardTitleText").textContent = title.text;
  }

  // 与表格退场共用时间轴，暂停冻结进度，循环首帧立即恢复比赛表布局。
  let previousTableWidth = null;
  function renderTableLayout({ tableLayoutProgress }) {
    const { pageMargin, chartColumns } = layout;
    const progress = tableLayoutProgress * tableLayoutProgress * (3 - 2 * tableLayoutProgress);
    const tableWidth = chartColumns.gameTable
        + (chartColumns.teamTable - chartColumns.gameTable) * progress;
    if (tableWidth === previousTableWidth) return;
    previousTableWidth = tableWidth;
    const dashboard = document.getElementById("dashboard");
    dashboard.style.setProperty("--data-table-width", `${tableWidth * 100}%`);
    dashboard.style.setProperty("--score-chart-width", `${(1 - pageMargin.horizontal * 2 - tableWidth) * 100}%`);
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
      const playbackTasks = ScoreTimeline.createPlaybackTasks();
      const chart = ScoreChart.createScoreChart(
          document.getElementById("scoreChart"), data.teams, finalGame, APP_CONFIG
      );
      const gameTable = GameTable.createGameTable(
          document.getElementById("gameTable"),
          document.getElementById("teamTableSlot"),
          data.games,
          APP_CONFIG.gameTable,
          playbackTasks
      );
      const teamTable = TeamTable.createTeamTable(
          document.getElementById("teamTableSlot"), data.teams, APP_CONFIG.teamTable, playbackTasks
      );
      const timeline = ScoreTimeline.createTimeline({ animation, finalGame });
      // 使用同一时间状态驱动折线图和比赛详情
      // 先更新布局，再按新尺寸绘图，避免宽度变化落后一帧。
      timeline.subscribe(renderTableLayout);
      timeline.subscribe(chart.render);
      timeline.subscribe(gameTable.render);
      timeline.subscribe(teamTable.render);
      const dashboard = document.getElementById("dashboard");
      let paused = false;
      let pausedAnimations = [];
      document.addEventListener("keydown", event => {
        if (event.code !== "Space" || event.altKey || event.ctrlKey || event.metaKey) return;
        // 编辑控件中的空格保留原有输入行为。
        const target = event.target;
        if (target instanceof HTMLElement
            && (target.isContentEditable || target.closest("input, textarea, select, button"))) return;
        event.preventDefault();
        if (event.repeat) return;

        paused = !paused;
        if (paused) {
          timeline.pause();
          playbackTasks.pause();
          // getAnimations 同时包含 CSS animation 和 transition，保留各自的当前进度。
          pausedAnimations = dashboard.getAnimations({ subtree: true }).filter(animation =>
            animation.playState === "running" || animation.pending
          );
          pausedAnimations.forEach(animation => animation.pause());
        } else {
          pausedAnimations.forEach(animation => animation.play());
          pausedAnimations = [];
          playbackTasks.resume();
          timeline.resume();
        }
      });
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

