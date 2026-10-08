(function exposeGameTable(global) {
  "use strict";

  // 选手头像和比赛条目背景队标使用固定资源目录。
  const PLAYER_IMAGE_BASE_URL = "assets/images/players";
  const TEAM_IMAGE_BASE_URL = "assets/images/teams";

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
    row.style.setProperty("--team-color", player.teamColor);

    const identity = createElement("div", "game-table__identity");
    identity.append(
        createElement("strong", "game-table__name", player.name)
    );

    const score = createElement("div", "game-table__score");
    score.append(
        createElement("strong", "game-table__score-total", player.score.toLocaleString("zh-CN")),
        createElement("span", "game-table__team-point", formatTeamPoint(player.teamPoint))
    );
    row.append(
        createImage(
            "game-table__team-mark",
            imageUrl(TEAM_IMAGE_BASE_URL, player.team),
            ""
        ),
        identity,
        score,
        createImage(
            "game-table__portrait",
            imageUrl(PLAYER_IMAGE_BASE_URL, player.name),
            `${player.name}的头像`
        )
    );
    return row;
  }

  function createGameSection(game, startOrder, config) {
    const section = createElement("section", "game-table__section");
    section.setAttribute("aria-label", `${game.info} 比赛`);
    const header = createElement("header", "game-table__header");
    header.append(
        createElement("h2", "game-table__title", game.info)
    );
    const list = createElement("ol", "game-table__list");
    const orderedPlayers = game.players.map((player, sourceIndex) => ({ player, sourceIndex }))
        .sort((a, b) => b.player.score - a.player.score || a.sourceIndex - b.sourceIndex);
    orderedPlayers.forEach(({ player }, index) => {
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
    if (!Number.isFinite(config.rowTransitionDuration) || config.rowTransitionDuration < 0
        || !Number.isFinite(config.rowTransitionDelay) || config.rowTransitionDelay < 0) {
      throw new Error("game-table 动画时长必须是大于或等于 0 的数字");
    }
    const itemFontSizeNames = ["playerName", "totalScore", "convertedTeamScore"];
    itemFontSizeNames.forEach(name => {
      if (!Number.isFinite(config.itemFontSizes?.[name]) || config.itemFontSizes[name] <= 0) {
        throw new Error(`gameTable.itemFontSizes.${name} 必须是大于 0 的数字`);
      }
    });
    const positiveConfigNames = ["itemHeightRatio", "playerImageHeightRatio"];
    positiveConfigNames.forEach(name => {
      if (!Number.isFinite(config[name]) || config[name] <= 0) {
        throw new Error(`gameTable.${name} 必须是大于 0 的数字`);
      }
    });
    const nonNegativeConfigNames = ["itemGapRatio", "totalScoreRightGap", "headerItemGap"];
    nonNegativeConfigNames.forEach(name => {
      if (!Number.isFinite(config[name]) || config[name] < 0) {
        throw new Error(`gameTable.${name} 必须是大于或等于 0 的数字`);
      }
    });
    if (!Number.isFinite(config.headerFontSize) || config.headerFontSize <= 0) {
      throw new Error("gameTable.headerFontSize 必须是大于 0 的数字");
    }

    const transitionLength = config.rowTransitionDuration + config.rowTransitionDelay * 7;
    // 所有面板提前创建和解码，切换到后续比赛时不再触发图片请求。
    const panels = Array.from({ length: Math.ceil(games.length / 2) }, (_, index) => {
      const element = createPanel(games, index, config);
      return {
        element,
        rows: Array.from(element.querySelectorAll(".game-table__row")),
        headers: Array.from(element.querySelectorAll(".game-table__header"))
      };
    });
    const ready = Promise.all(panels.flatMap(panel =>
      Array.from(panel.element.querySelectorAll("img"), image => ScoreResources.prepareImage(image))
    ));
    let activePanel = null;

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
        "--game-table-player-image-height-ratio",
        config.playerImageHeightRatio
    );
    root.style.setProperty(
        "--game-table-total-score-right-gap",
        `${config.totalScoreRightGap}px`
    );
    root.style.setProperty("--game-table-header-font-size", `${config.headerFontSize}px`);
    root.style.setProperty("--game-table-header-item-gap", `${config.headerItemGap}px`);

    function updateItemDimensions() {
      const regionHeight = root.getBoundingClientRect().height;
      root.style.setProperty(
          "--game-table-item-height",
          `${regionHeight * config.itemHeightRatio}px`
      );
      root.style.setProperty(
          "--game-table-item-gap",
          `${regionHeight * config.itemGapRatio}px`
      );
    }

    function showPanel(panel) {
      if (activePanel === panel) return;
      root.replaceChildren(panel.element);
      activePanel = panel;
    }

    function renderPanel(panel, elapsed, outgoing) {
      panel.rows.forEach((row, index) => {
        const time = elapsed - index * config.rowTransitionDelay;
        const raw = config.rowTransitionDuration > 0
            ? time / config.rowTransitionDuration : Number(time >= 0);
        const progress = outgoing
            ? ScoreTimeline.ease(raw, 0.55, 0, 0.8, 0.4)
            : ScoreTimeline.ease(raw, 0.2, 0.75, 0.25, 1);
        row.style.opacity = String(outgoing ? 1 - progress : progress);
        row.style.transform = `translateX(${outgoing ? -110 * progress : 110 * (1 - progress)}%)`;
      });
      const progress = transitionLength > 0 ? ScoreTimeline.ease(elapsed / 180) : 1;
      panel.headers.forEach(header => {
        header.style.opacity = String(outgoing ? 1 - progress : progress);
      });
    }

    function reset() {
      activePanel = null;
      root.replaceChildren();
      root.style.opacity = "0";
      root.style.transform = "translateX(0)";
      root.classList.add("game-table--hidden");
      root.setAttribute("aria-hidden", "true");
      teamTableSlot.hidden = true;
    }

    return Object.freeze({
      ready,
      reset,
      destroy() {
        reset();
        panels.length = 0;
      },
      render(state) {
        updateItemDimensions();
        const isOpening = state.phase === "background-hold" || state.phase === "entrance";
        if (isOpening) {
          reset();
          return;
        }
        const isOverview = state.phase === "overview" || state.phase === "restart-hold";
        const isExiting = state.phase === "game-table-exit";
        root.classList.toggle("game-table--hidden", isExiting || isOverview);
        root.setAttribute("aria-hidden", String(isExiting || isOverview));
        teamTableSlot.hidden = !isOverview;
        const progress = state.tableLayoutProgress;
        const easedProgress = progress * progress * (3 - 2 * progress);
        root.style.opacity = String(1 - easedProgress);
        root.style.transform = `translateX(${-5 * easedProgress}%)`;
        if (isOverview) return;

        const playTime = Math.max(0, state.cycleElapsed - state.introDuration);
        const index = Math.min(panels.length - 1, Math.floor(playTime / (2 * state.gameDuration)));
        const localTime = playTime - index * 2 * state.gameDuration;
        const outgoing = index > 0 && localTime < transitionLength;
        const panel = panels[outgoing ? index - 1 : index];
        showPanel(panel);
        renderPanel(panel, outgoing ? localTime : localTime - (index > 0 ? transitionLength : 0), outgoing);
      }
    });
  }

  global.GameTable = Object.freeze({ createGameTable });
}(globalThis));
