(function startApplication() {
  "use strict";

  const { animation, backgroundColor, dataUrl, layout, gamesDataUrl } = APP_CONFIG;

  // 将布局比例转换为 CSS 百分比
  function percentage(value, name) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`${name} 必须是大于 0 且小于 1 的数字`);
    }
    return `${value * 100}%`;
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
    const thickness = layout.divider.thickness;
    if (!Number.isFinite(thickness) || thickness < 0) {
      throw new Error("layout.divider.thickness 必须是大于或等于 0 的数字");
    }
    if (!CSS.supports("color", layout.divider.color)) {
      throw new Error(`分隔线颜色“${layout.divider.color}”无效`);
    }

    dashboard.style.setProperty("--vertical-split", percentage(layout.verticalSplit, "layout.verticalSplit"));
    dashboard.style.setProperty("--horizontal-split", percentage(layout.horizontalSplit, "layout.horizontalSplit"));
    dashboard.style.setProperty("--divider-thickness", `${thickness}px`);
    dashboard.style.setProperty("--divider-color", layout.divider.color);
    dashboard.classList.toggle("dashboard--dividers-visible", layout.divider.visible);
  }

  // 加载数据并装配图表与公共时间轴
  async function start() {
    try {
      applyAppearance();
      applyLayout();
      const [scoreResponse, gamesResponse] = await Promise.all([
        fetch(dataUrl, { cache: "no-store" }),
        fetch(gamesDataUrl, { cache: "no-store" })
      ]);
      if (!scoreResponse.ok) throw new Error(`读取 ${dataUrl} 失败（HTTP ${scoreResponse.status}）`);
      if (!gamesResponse.ok) {
        throw new Error(`读取 ${gamesDataUrl} 失败（HTTP ${gamesResponse.status}）`);
      }

      const data = ScoreData.parseScoreCsv(await scoreResponse.text());
      const gameData = GameData.parseGamesJson(await gamesResponse.text());
      // 在绘图前验证所有队伍颜色
      data.teams.forEach((team, index) => {
        if (!CSS.supports("color", team.color)) {
          throw new Error(`第 ${index + 1} 支队伍的 color“${team.color}”无效`);
        }
      });

      const finalGame = data.games.length - 1;
      if (gameData.games.length !== finalGame + 1) {
        throw new Error(
          `比赛详情有 ${gameData.games.length} 个 game，积分时间线有 ${finalGame + 1} 个 game`
        );
      }
      const chart = ScoreChart.createScoreChart(
          document.getElementById("scoreChart"), data.teams, finalGame, APP_CONFIG
      );
      const gameTable = GameTable.createGameTable(
          document.getElementById("gameTable"),
          document.getElementById("teamTableSlot"),
          gameData.games,
          APP_CONFIG.gameTable
      );
      const timeline = ScoreTimeline.createTimeline({ animation, finalGame });
      // 使用同一时间状态驱动折线图和比赛详情
      timeline.subscribe(chart.render);
      timeline.subscribe(gameTable.render);
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
