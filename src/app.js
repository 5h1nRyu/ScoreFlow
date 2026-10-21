(function startApplication() {
  "use strict";

  const { animation, backgroundColor, useBackgroundImage, debug, layout, title } = APP_CONFIG;
  // 数据文件位置固定，不作为外观配置提供。
  const TEAMS_DATA_URL = "data/teams.json";
  const GAMES_DATA_URL = "data/games.json";
  // 导出器在脚本运行前注入；从启动阶段就禁止自动播放。
  let exportMode = Boolean(globalThis.__VIDEO_EXPORT_REQUEST__);
  let disposed = false;
  let dataPromise = null;
  let application = null;
  let initializing = null;
  const dataController = new AbortController();

  // 将布局比例转换为 CSS 百分比
  function percentage(value, name) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`${name} 必须是大于 0 且小于 1 的数字`);
    }
    return `${value * 100}%`;
  }

  // 校验并将页面外观配置写入样式表
  function applyAppearance() {
    if (typeof useBackgroundImage !== "boolean") {
      throw new Error("useBackgroundImage 必须是布尔值");
    }
    if (!CSS.supports("color", backgroundColor)) {
      throw new Error(`背景颜色“${backgroundColor}”无效`);
    }
    document.documentElement.style.setProperty("--background-color", backgroundColor);
    document.body.classList.toggle("page--image-background", useBackgroundImage);
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
    if (Math.abs(verticalTotal - 1) > Number.EPSILON * 10) {
      throw new Error("layout 的纵向比例之和必须为 1");
    }
    // 两个表格共用同一列，切换时保持表格与折线图宽度不变。
    const tableWidth = chartColumns.dataTable;
    const scoreChartWidth = 1 - pageMargin.horizontal * 2 - tableWidth;
    if (!Number.isFinite(title.fontSize) || title.fontSize <= 0) {
      throw new Error("title.fontSize 必须是大于 0 的数字");
    }
    if (!Number.isInteger(title.fontWeight) || title.fontWeight < 100 || title.fontWeight > 900) {
      throw new Error("title.fontWeight 必须是 100 到 900 的整数");
    }
    if (typeof title.text !== "string" || title.text.length === 0) {
      throw new Error("title.text 必须是非空字符串");
    }
    const variables = {
      "--page-horizontal-margin": [pageMargin.horizontal, "layout.pageMargin.horizontal"],
      "--page-top-margin": [pageMargin.top, "layout.pageMargin.top"],
      "--page-bottom-margin": [pageMargin.bottom, "layout.pageMargin.bottom"],
      "--title-height": [rows.title, "layout.rows.title"],
      "--chart-height": [rows.chart, "layout.rows.chart"],
      "--data-table-width": [tableWidth, "layout.chartColumns.dataTable"],
      "--score-chart-width": [scoreChartWidth, "layout.chartColumns.dataTable 对应的剩余折线图比例"]
    };
    Object.entries(variables).forEach(([property, [value, name]]) => {
      dashboard.style.setProperty(property, percentage(value, name));
    });
    dashboard.style.setProperty("--title-font-size", `${title.fontSize}px`);
    dashboard.style.setProperty("--title-font-weight", String(title.fontWeight));
    const titleElement = document.getElementById("dashboardTitleText");
    titleElement.setAttribute("aria-label", title.text);
    // 主标题从背景停留阶段起显示，不参与图表内容的入场动画。
    titleElement.textContent = title.text;
  }

  let previousEntranceProgress = null;
  function renderEntrance({ phase, entranceProgress }) {
    document.getElementById("dashboard").dataset.phase = phase;
    if (entranceProgress === previousEntranceProgress) return;
    previousEntranceProgress = entranceProgress;
    const easedProgress = entranceProgress * entranceProgress * (3 - 2 * entranceProgress);
    document.getElementById("scoreChart").style.opacity = String(easedProgress);

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

  function assertOpen() {
    if (disposed) throw new Error("ScoreFlow 已释放，请重新打开页面");
  }

  function loadData() {
    assertOpen();
    if (!dataPromise) dataPromise = (async () => {
      const [teamsResponse, gamesResponse] = await Promise.all([
        fetch(TEAMS_DATA_URL, { cache: "no-store", signal: dataController.signal }),
        fetch(GAMES_DATA_URL, { cache: "no-store", signal: dataController.signal })
      ]);
      if (!teamsResponse.ok) throw new Error(`读取 ${TEAMS_DATA_URL} 失败（HTTP ${teamsResponse.status}）`);
      if (!gamesResponse.ok) throw new Error(`读取 ${GAMES_DATA_URL} 失败（HTTP ${gamesResponse.status}）`);
      const teamData = TeamData.parseTeamsJson(await teamsResponse.text());
      const gameData = GameData.parseGamesJson(await gamesResponse.text());
      const data = limitDataForDebug(TeamData.combineWithGames(teamData, gameData));
      data.teams.forEach((team, index) => {
        if (!CSS.supports("color", team.color)) throw new Error(`第 ${index + 1} 支队伍的 color“${team.color}”无效`);
      });
      ScoreTimeline.getCycleDuration(animation, data.games.length - 1);
      assertOpen();
      return data;
    })();
    return dataPromise;
  }

  function destroyApplication() {
    if (!application) return;
    const previous = application;
    application = null;
    previous.timeline.destroy();
    previous.resizeObserver?.disconnect();
    document.removeEventListener("keydown", previous.onKeydown);
    previous.chart.destroy();
    previous.gameTable.destroy();
    previous.teamTable.destroy();
  }

  async function initialize(options) {
    assertOpen();
    applyAppearance();
    previousEntranceProgress = null;
    applyLayout();
    const data = await loadData();
    await Promise.all([
      ScoreResources.prepareImage(document.querySelector(".creator-brand__logo"), true),
      ScoreResources.prepareFont(title.text + data.games.map(game => game.info).join("")),
      ScoreResources.prepareBackground(Boolean(options))
    ]);
    assertOpen();
    const manual = Boolean(options);
    const components = [];
    try {
      const chart = ScoreChart.createScoreChart(
          document.getElementById("scoreChart"), data.teams, data.games, APP_CONFIG,
          // 应用级尺寸观察统一重绘所有组件；导出不注册任何尺寸观察回调。
          { manual: true, deviceScaleFactor: options?.deviceScaleFactor }
      );
      components.push(chart);
      const gameTable = GameTable.createGameTable(
          document.getElementById("gameTable"), document.getElementById("teamTableSlot"),
          data.games, APP_CONFIG.gameTable
      );
      components.push(gameTable);
      const teamTable = TeamTable.createTeamTable(
          document.getElementById("teamTableSlot"), data.teams, APP_CONFIG.teamTable
      );
      components.push(teamTable);
      const timeline = ScoreTimeline.createTimeline({ animation, finalGame: data.games.length - 1, manual });
      components.push(timeline);
      let lastState = null;
      let paused = false;
      const onKeydown = event => {
        if (exportMode || event.code !== "Space" || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (target instanceof HTMLElement
            && (target.isContentEditable || target.closest("input, textarea, select, button"))) return;
        event.preventDefault();
        if (event.repeat) return;
        paused = !paused;
        if (paused) timeline.pause();
        else timeline.resume();
      };
      timeline.subscribe(renderEntrance);
      // 先设置表格可见性，再测量尺寸、绘制当前帧。
      timeline.subscribe(gameTable.render);
      timeline.subscribe(teamTable.render);
      timeline.subscribe(chart.render);
      timeline.subscribe(state => {
        document.getElementById("missionGame").textContent = String(Math.max(0, state.tableCompletedGame + 1)).padStart(2, "0") + ' / ' + String(data.games.length).padStart(2, "0");
        const progress = state.replayProgress * 100;
        const progressElement = document.getElementById("missionProgress");
        progressElement.setAttribute("aria-valuenow", String(Math.round(progress)));
        progressElement.firstElementChild.style.width = progress + '%';
        const isOverview = state.phase === "overview" || state.phase === "restart-hold";
        document.getElementById("dataPanelTitle").textContent = isOverview ? "队伍排名" : "对局记录";
      });
      timeline.subscribe(state => { lastState = state; });
      const resizeObserver = manual ? null : new ResizeObserver(() => {
        if (lastState) timeline.renderAt(lastState.elapsed, 0);
      });
      resizeObserver?.observe(document.getElementById("dashboard"));
      if (!manual) {
        document.addEventListener("keydown", onKeydown);
      }
      application = { timeline, chart, gameTable, teamTable, resizeObserver, onKeydown };
      await Promise.all([gameTable.ready, teamTable.ready]);
      assertOpen();
      timeline.renderAt(0, 0);
      chart.finishFrame();
      document.getElementById("dataError").hidden = true;
      return application;
    } catch (error) {
      if (application) destroyApplication();
      else components.reverse().forEach(component => component.destroy());
      throw error;
    }
  }

  async function getManifest() {
    const data = await loadData();
    const durationMs = ScoreTimeline.getCycleDuration(animation, data.games.length - 1);
    if (!(durationMs > 0 && durationMs <= 24 * 60 * 60 * 1000)) throw new Error("导出时长必须在 0 到 24 小时之间");
    if (typeof title.text !== "string" || !title.text.trim()) throw new Error("导出名称不能为空");
    // 元数据只加载数据，不创建组件、不依赖 prepare，更不启动播放。
    return { name: title.text, durationMs, recommendedViewport: { width: 1920, height: 1080 }, supportsSeeking: false };
  }

  async function prepare(options) {
    assertOpen();
    exportMode = true;
    // 若在普通页面上手动调用接口，也先停下播放，再等初始化完成并重建。
    application?.timeline.stop();
    if (initializing) await initializing.catch(() => {});
    assertOpen();
    destroyApplication();
    document.documentElement.style.width = `${options.viewport.width}px`;
    document.documentElement.style.height = `${options.viewport.height}px`;
    initializing = initialize(options);
    await initializing;
  }

  function reset() {
    assertOpen();
    const { timeline, chart, gameTable, teamTable } = application;
    timeline.reset();
    chart.reset();
    gameTable.reset();
    teamTable.reset();
    previousEntranceProgress = null;
    timeline.renderAt(0, 0);
    chart.finishFrame();
    document.documentElement.getBoundingClientRect();
  }

  function renderFrame(frame) {
    assertOpen();
    application.timeline.renderAt(frame.timeMs, frame.deltaMs);
    application.chart.finishFrame();
    // DOM 样式与布局同步提交，Canvas 2D 已同步绘制，不需要计时器或实时循环推进。
    document.documentElement.getBoundingClientRect();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    dataController.abort();
    destroyApplication();
  }

  globalThis.ScoreApplication = Object.freeze({ getManifest, prepare, reset, renderFrame, dispose });
  if (!exportMode) {
    initializing = initialize(null);
    initializing.then(result => {
      if (!disposed && !exportMode) result.timeline.start();
    }).catch(error => {
      if (disposed) return;
      const message = error instanceof Error ? error.message : String(error);
      const errorElement = document.getElementById("dataError");
      errorElement.textContent = `无法加载页面数据：${message}`;
      errorElement.hidden = false;
      console.error(error);
    });
  }
}());
