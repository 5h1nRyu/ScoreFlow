(function exposeTeamTable(global) {
  "use strict";

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function imageUrl(baseUrl, teamName) {
    return `${baseUrl}/${encodeURIComponent(teamName)}.png`;
  }

  function scoreFormatter(value) {
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
  }

  // 同分使用竞赛排名（1、2、2、4），并保持原数据顺序稳定。
  function rankTeams(teams, getScore) {
    const ordered = teams.map((team, sourceIndex) => ({ team, sourceIndex, score: getScore(team) }))
        .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex);
    let previousScore;
    let rank = 0;
    ordered.forEach((entry, index) => {
      if (index === 0 || entry.score !== previousScore) rank = index + 1;
      entry.position = index;
      entry.rank = rank;
      previousScore = entry.score;
    });
    return ordered;
  }

  function easeInOut(value) {
    return value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function createTeamTable(root, teams, config) {
    if (!(root instanceof HTMLElement)) throw new Error("team-table 需要有效的挂载元素");
    if (!Array.isArray(teams) || teams.length !== 10) {
      throw new Error("team-table 必须恰好接收 10 支队伍");
    }
    ["initialTitle", "finalTitle"].forEach(name => {
      if (typeof config[name] !== "string" || !config[name].trim()) {
        throw new Error(`teamTable.${name} 必须是非空字符串`);
      }
    });
    ["itemHeightRatio", "teamImageHeight"].forEach(name => {
      if (!Number.isFinite(config[name]) || config[name] <= 0) {
        throw new Error(`teamTable.${name} 必须是大于 0 的数字`);
      }
    });
    if (!Number.isFinite(config.itemGapRatio) || config.itemGapRatio < 0) {
      throw new Error("teamTable.itemGapRatio 必须是大于或等于 0 的数字");
    }
    if (!Number.isFinite(config.reorderScaleAmplitude) || config.reorderScaleAmplitude < 0) {
      throw new Error("teamTable.reorderScaleAmplitude 必须是大于或等于 0 的数字");
    }
    ["rank", "teamName", "score", "rankChange"].forEach(name => {
      if (!Number.isFinite(config.itemFontSizes?.[name]) || config.itemFontSizes[name] <= 0) {
        throw new Error(`teamTable.itemFontSizes.${name} 必须是大于 0 的数字`);
      }
    });

    const initialOrder = rankTeams(teams, team => team.initialScore);
    const finalOrder = rankTeams(teams, team => team.values.at(-1));
    const initialByName = new Map(initialOrder.map(entry => [entry.team.name, entry]));
    const finalByName = new Map(finalOrder.map(entry => [entry.team.name, entry]));
    const title = createElement("h2", "team-table__title", config.initialTitle);
    const list = createElement("ol", "team-table__list");
    const rows = new Map();
    let itemHeight = 0;
    let itemGap = 0;

    root.classList.add("team-table");
    root.style.setProperty("--team-table-rank-font-size", `${config.itemFontSizes.rank}px`);
    root.style.setProperty("--team-table-name-font-size", `${config.itemFontSizes.teamName}px`);
    root.style.setProperty("--team-table-score-font-size", `${config.itemFontSizes.score}px`);
    root.style.setProperty("--team-table-change-font-size", `${config.itemFontSizes.rankChange}px`);
    root.style.setProperty("--team-table-logo-height", `${config.teamImageHeight}px`);

    initialOrder.forEach(entry => {
      const row = createElement("li", "team-table__row");
      row.style.setProperty("--team-color", entry.team.color);
      const rank = createElement("span", "team-table__rank", String(entry.rank));
      const logo = createElement("img", "team-table__logo");
      logo.src = imageUrl(config.teamImageBaseUrl, entry.team.name);
      logo.alt = `${entry.team.name}队标`;
      logo.addEventListener("error", () => logo.classList.add("team-table__logo--missing"), { once: true });
      const name = createElement("strong", "team-table__name", entry.team.name);
      const score = createElement("strong", "team-table__score", scoreFormatter(entry.score));
      const finalEntry = finalByName.get(entry.team.name);
      const difference = entry.rank - finalEntry.rank;
      const change = createElement("span", "team-table__change");
      if (difference > 0) {
        change.classList.add("team-table__change--up");
        change.textContent = `▲ ${difference}`;
        change.setAttribute("aria-label", `排名上升 ${difference} 位`);
      } else if (difference < 0) {
        change.classList.add("team-table__change--down");
        change.textContent = `▼ ${Math.abs(difference)}`;
        change.setAttribute("aria-label", `排名下降 ${Math.abs(difference)} 位`);
      } else {
        change.classList.add("team-table__change--same");
        change.textContent = "=";
        change.setAttribute("aria-label", "排名不变");
      }
      row.append(rank, logo, name, score, change);
      list.append(row);
      rows.set(entry.team.name, { change, rank, row, score });
    });
    root.replaceChildren(title, list);

    function rankText(order, entry) {
      const previous = order[entry.position - 1];
      return previous?.score === entry.score ? "-" : String(entry.rank);
    }

    function updateDimensions() {
      const height = list.getBoundingClientRect().height;
      itemHeight = height * config.itemHeightRatio;
      itemGap = height * config.itemGapRatio;
      root.style.setProperty("--team-table-item-height", `${itemHeight}px`);
    }
    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(root);

    function render(state) {
      if (state.phase !== "overview" && state.phase !== "restart-hold") return;
      const isReordered = state.overviewStage === "reorder"
          || state.overviewStage === "final-hold"
          || state.phase === "restart-hold";
      title.textContent = isReordered ? config.finalTitle : config.initialTitle;
      const rawProgress = state.overviewStage === "reorder"
          ? state.overviewStageProgress
          : Number(isReordered);
      const progress = easeInOut(rawProgress);
      const enterProgress = state.overviewStage === "team-table-enter"
          ? state.overviewStageProgress
          : 1;

      initialOrder.forEach((initialEntry, initialIndex) => {
        const finalEntry = finalByName.get(initialEntry.team.name);
        const elements = rows.get(initialEntry.team.name);
        const staggerStart = initialIndex * 0.045;
        const localEnter = Math.min(1, Math.max(0, (enterProgress - staggerStart) / (1 - 0.045 * 9)));
        const easedEnter = easeInOut(localEnter);
        const position = initialEntry.position
            + (finalEntry.position - initialEntry.position) * progress;
        const direction = Math.sign(initialEntry.position - finalEntry.position);
        const scale = 1 + direction * config.reorderScaleAmplitude * Math.sin(Math.PI * progress);
        const y = position * (itemHeight + itemGap);
        elements.row.style.opacity = easedEnter;
        elements.row.style.zIndex = String(100 - finalEntry.position);
        elements.row.style.transform = `translate3d(${(1 - easedEnter) * 28}px, ${y}px, 0) scale(${scale})`;
        elements.rank.textContent = isReordered
            ? rankText(finalOrder, finalEntry)
            : rankText(initialOrder, initialEntry);
        const shownScore = initialEntry.score + (finalEntry.score - initialEntry.score) * progress;
        elements.score.textContent = scoreFormatter(shownScore);
        elements.change.classList.toggle("team-table__change--visible", isReordered);
      });
    }

    return Object.freeze({ render });
  }

  global.TeamTable = Object.freeze({ createTeamTable });
}(globalThis));
