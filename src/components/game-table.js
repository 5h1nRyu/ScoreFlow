(function exposeGameTable(global) {
  "use strict";

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatTeamPoint(value) {
    const normalized = Object.is(value, -0) ? 0 : value;
    return `${normalized > 0 ? "+" : ""}${normalized.toFixed(1)} pt`;
  }

  function imageUrl(baseUrl, fileName) {
    return `${baseUrl}/${encodeURIComponent(fileName)}.png`;
  }

  function teamColor(team, config) {
    const numericSuffix = Number.parseInt(team.match(/\d+$/)?.[0], 10);
    const seed = Number.isFinite(numericSuffix)
        ? numericSuffix - 1
        : [...team].reduce((total, character) => total + character.codePointAt(0), 0);
    return config.teamColors[((seed % config.teamColors.length) + config.teamColors.length)
    % config.teamColors.length];
  }

  function createImage(className, source, alt) {
    const image = createElement("img", className);
    image.src = source;
    image.alt = alt;
    image.addEventListener("error", () => image.classList.add(`${className}--missing`), { once: true });
    return image;
  }

  function createPlayerRow(player, order, config) {
    const row = createElement("li", "game-table__row");
    row.style.setProperty("--row-order", order);
    row.style.setProperty("--team-color", teamColor(player.team, config));

    const identity = createElement("div", "game-table__identity");
    identity.append(
        createImage(
            "game-table__portrait",
            imageUrl(config.playerImageBaseUrl, player.name),
            `${player.name}的头像`
        ),
        createImage(
            "game-table__team-mark",
            imageUrl(config.teamImageBaseUrl, player.team),
            ""
        ),
        createElement("strong", "game-table__name", player.name)
    );

    const score = createElement("div", "game-table__score");
    score.append(
        createElement("strong", "game-table__score-total", player.score.toLocaleString("zh-CN")),
        createElement("span", "game-table__team-point", formatTeamPoint(player.teamPoint))
    );
    row.append(
        identity,
        score,
        createElement("span", "game-table__stat", player.riichiCount),
        createElement("span", "game-table__stat", player.winCount),
        createElement("span", "game-table__stat", player.dealInCount)
    );
    return row;
  }

  function createGameSection(game, startOrder, config) {
    const section = createElement("section", "game-table__section");
    section.setAttribute("aria-label", `${game.info} 比赛`);
    const header = createElement("header", "game-table__header");
    header.append(
        createElement("h2", "game-table__title", game.info),
        createElement("span", "game-table__column-label game-table__column-label--riichi", "立直"),
        createElement("span", "game-table__column-label", "和了"),
        createElement("span", "game-table__column-label", "放铳")
    );
    const list = createElement("ol", "game-table__list");
    game.players.forEach((player, index) => {
      list.append(createPlayerRow(player, startOrder + index, config));
    });
    section.append(header, list);
    return section;
  }

  function createPanel(games, pairIndex, config) {
    const panel = createElement("div", "game-table__panel");
    games.slice(pairIndex * 2, pairIndex * 2 + 2).forEach((game, index) => {
      panel.append(createGameSection(game, index * 4, config));
    });
    return panel;
  }

  function createGameTable(root, teamTableSlot, games, config) {
    if (!(root instanceof HTMLElement) || !(teamTableSlot instanceof HTMLElement)) {
      throw new Error("game-table 需要有效的挂载元素");
    }
    if (!Array.isArray(games) || !games.length) throw new Error("game-table 缺少比赛数据");
    if (games.length % 2 !== 0) throw new Error("game-table 的 game 数量必须是偶数");
    if (!Number.isFinite(config.rowTransitionDuration) || config.rowTransitionDuration < 0
        || !Number.isFinite(config.rowTransitionDelay) || config.rowTransitionDelay < 0) {
      throw new Error("game-table 动画时长必须是大于或等于 0 的数字");
    }
    if (!Array.isArray(config.teamColors) || !config.teamColors.length) {
      throw new Error("game-table 至少需要一种队伍颜色");
    }

    const itemFontSizeNames = ["playerName", "totalScore", "convertedTeamScore", "stat"];
    itemFontSizeNames.forEach(name => {
      if (!Number.isFinite(config.itemFontSizes?.[name]) || config.itemFontSizes[name] <= 0) {
        throw new Error(`gameTable.itemFontSizes.${name} 必须是大于 0 的数字`);
      }
    });

    // const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduceMotion = false;
    const transitionLength = config.rowTransitionDuration
      + config.rowTransitionDelay * 7;
    let activeIndex = -1;
    let activePanel = null;
    let pendingPanel = null;
    let transitionTimer = 0;
    let transitionFrame = 0;
    let hiddenForOverview = null;

    config.teamColors.forEach(color => {
      if (!CSS.supports("color", color)) throw new Error(`game-table 队伍颜色“${color}”无效`);
    });
    root.style.setProperty("--row-transition-duration", `${config.rowTransitionDuration}ms`);
    root.style.setProperty("--row-transition-delay", `${config.rowTransitionDelay}ms`);
    root.style.setProperty(
        "--game-table-player-name-font-size",
        `${config.itemFontSizes.playerName}px`
    );
    root.style.setProperty(
        "--game-table-total-score-font-size",
        `${config.itemFontSizes.totalScore}px`
    );
    root.style.setProperty(
        "--game-table-converted-score-font-size",
        `${config.itemFontSizes.convertedTeamScore}px`
    );
    root.style.setProperty(
        "--game-table-stat-font-size",
        `${config.itemFontSizes.stat}px`
    );

    function finishTransition(nextPanel) {
      clearTimeout(transitionTimer);
      cancelAnimationFrame(transitionFrame);
      transitionTimer = 0;
      transitionFrame = 0;

      root.replaceChildren(nextPanel);
      nextPanel.classList.remove(
          "game-table__panel--incoming",
          "game-table__panel--entering",
          "game-table__panel--outgoing"
      );
      activePanel = nextPanel;
      pendingPanel = null;
    }

    function startIncomingTransition(nextPanel) {
      if (pendingPanel !== nextPanel) return;

      root.replaceChildren(nextPanel);
      nextPanel.classList.add("game-table__panel--incoming");
      activePanel = null;

      // 分两帧应用入场状态，让浏览器先处理面板的初始样式。
      transitionFrame = requestAnimationFrame(() => {
        transitionFrame = requestAnimationFrame(() => {
          transitionFrame = 0;
          if (pendingPanel !== nextPanel) return;

          nextPanel.classList.add("game-table__panel--entering");
          transitionTimer = window.setTimeout(() => {
            if (pendingPanel === nextPanel) finishTransition(nextPanel);
          }, transitionLength);
        });
      });
    }

    function showGamePair(index, animate) {
      const pairCount = games.length / 2;
      const nextIndex = Math.min(pairCount - 1, Math.max(0, index));
      if (nextIndex === activeIndex) {
        // 重播要求立即展示时，也要结束同一目标上尚未完成的动画。
        if (!animate && pendingPanel) finishTransition(pendingPanel);
        return;
      }

      const nextPanel = createPanel(games, nextIndex, config);

      // 中途切换到其他比赛时，先收尾上一轮动画，清除残留面板和回调。
      if (pendingPanel) finishTransition(pendingPanel);

      // 必须在动画开始时记录目标，防止每帧重复创建同一个面板。
      activeIndex = nextIndex;

      if (!activePanel || !animate || reduceMotion || transitionLength === 0) {
        finishTransition(nextPanel);
        return;
      }

      activePanel.classList.add("game-table__panel--outgoing");
      pendingPanel = nextPanel;
      // 旧面板完全退场并移除后才挂载新面板，避免两套文字同时存在。
      transitionTimer = window.setTimeout(() => startIncomingTransition(nextPanel), transitionLength);
    }

    function setOverviewVisibility(isOverview) {
      if (isOverview === hiddenForOverview) return;
      hiddenForOverview = isOverview;
      root.classList.toggle("game-table--hidden", isOverview);
      root.setAttribute("aria-hidden", String(isOverview));
      teamTableSlot.hidden = !isOverview;

      // 隐藏前完成切换，避免动画回调跨越总览和重播阶段。
      if (isOverview && pendingPanel) finishTransition(pendingPanel);
    }

    return Object.freeze({
      render(state) {
        const isOverview = state.phase === "overview" || state.phase === "restart-hold";
        setOverviewVisibility(isOverview);
        if (isOverview) return;
        showGamePair(Math.floor(state.completedGame / 2), activeIndex >= 0 && !state.didRestart);
      }
    });
  }

  global.GameTable = Object.freeze({ createGameTable });
}(globalThis));
