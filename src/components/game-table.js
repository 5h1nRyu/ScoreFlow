(function exposeGameTable(global) {
  "use strict";

  const GAME_KEYS = Object.freeze(["gameA", "gameB"]);

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

  function createGameSection(match, gameKey, startOrder, config) {
    const section = createElement("section", "game-table__section");
    section.setAttribute("aria-label", `${gameKey === "gameA" ? "第一" : "第二"}桌比赛`);
    const header = createElement("header", "game-table__header");
    header.append(
      createElement("h2", "game-table__title", `第${match.matchId}场 · ${gameKey === "gameA" ? "A桌" : "B桌"}`),
      createElement("span", "game-table__column-label game-table__column-label--riichi", "立直"),
      createElement("span", "game-table__column-label", "和了"),
      createElement("span", "game-table__column-label", "放铳")
    );
    const list = createElement("ol", "game-table__list");
    match[gameKey].players.forEach((player, index) => {
      list.append(createPlayerRow(player, startOrder + index, config));
    });
    section.append(header, list);
    return section;
  }

  function createPanel(match, config) {
    const panel = createElement("div", "game-table__panel");
    GAME_KEYS.forEach((gameKey, index) => {
      panel.append(createGameSection(match, gameKey, index * 4, config));
    });
    return panel;
  }

  function createGameTable(root, teamTableSlot, matches, config) {
    if (!(root instanceof HTMLElement) || !(teamTableSlot instanceof HTMLElement)) {
      throw new Error("game-table 需要有效的挂载元素");
    }
    if (!Array.isArray(matches) || !matches.length) throw new Error("game-table 缺少比赛数据");
    if (!Number.isFinite(config.rowTransitionDuration) || config.rowTransitionDuration < 0
        || !Number.isFinite(config.rowTransitionDelay) || config.rowTransitionDelay < 0) {
      throw new Error("game-table 动画时长必须是大于或等于 0 的数字");
    }
    if (!Array.isArray(config.teamColors) || !config.teamColors.length) {
      throw new Error("game-table 至少需要一种队伍颜色");
    }

    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionLength = config.rowTransitionDuration
      + config.rowTransitionDelay * 7;
    let activeIndex = -1;
    let activePanel = null;
    let transitionTimer = 0;
    let hiddenForOverview = false;

    config.teamColors.forEach(color => {
      if (!CSS.supports("color", color)) throw new Error(`game-table 队伍颜色“${color}”无效`);
    });
    root.style.setProperty("--row-transition-duration", `${config.rowTransitionDuration}ms`);
    root.style.setProperty("--row-transition-delay", `${config.rowTransitionDelay}ms`);
    root.style.setProperty("--incoming-base-delay", `${transitionLength}ms`);

    function finishTransition(nextPanel, nextIndex) {
      root.replaceChildren(nextPanel);
      nextPanel.classList.remove("game-table__panel--incoming");
      activePanel = nextPanel;
      activeIndex = nextIndex;
      transitionTimer = 0;
    }

    function showMatch(index, animate) {
      const nextIndex = Math.min(matches.length - 1, Math.max(0, index));
      if (nextIndex === activeIndex) return;
      clearTimeout(transitionTimer);
      const nextPanel = createPanel(matches[nextIndex], config);
      if (!activePanel || !animate || reduceMotion) {
        finishTransition(nextPanel, nextIndex);
        return;
      }

      activePanel.classList.add("game-table__panel--outgoing");
      nextPanel.classList.add("game-table__panel--incoming");
      root.append(nextPanel);
      requestAnimationFrame(() => nextPanel.classList.add("game-table__panel--entering"));
      transitionTimer = window.setTimeout(
        () => finishTransition(nextPanel, nextIndex),
        transitionLength * 2
      );
    }

    function setOverviewVisibility(isOverview) {
      if (isOverview === hiddenForOverview) return;
      hiddenForOverview = isOverview;
      root.classList.toggle("game-table--hidden", isOverview);
      root.setAttribute("aria-hidden", String(isOverview));
      teamTableSlot.hidden = !isOverview;
    }

    return Object.freeze({
      render(state) {
        const isOverview = state.phase === "overview" || state.phase === "restart-hold";
        setOverviewVisibility(isOverview);
        if (isOverview) return;
        showMatch(state.completedMatch, activeIndex >= 0 && !state.didRestart);
      }
    });
  }

  global.GameTable = Object.freeze({ createGameTable });
}(globalThis));
