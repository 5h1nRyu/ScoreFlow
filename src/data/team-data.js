(function exposeTeamData(global) {
  "use strict";

  function assertNonEmptyString(value, path) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${path} 必须是非空字符串`);
    }
  }

  function parseTeamsJson(text, initialScores) {
    let source;
    try {
      source = JSON.parse(text);
    } catch (error) {
      throw new Error(`队伍数据不是有效 JSON：${error.message}`);
    }
    if (!source || !Array.isArray(source.teams) || source.teams.length !== 10) {
      throw new Error("队伍数据必须恰好包含 10 支队伍");
    }

    if (!initialScores || typeof initialScores !== "object" || Array.isArray(initialScores)) {
      throw new Error("必须提供所选月份的 initialScores 月初积分快照");
    }
    const teamNames = new Set();
    const playerTeams = new Map();
    const teams = source.teams.map((team, teamIndex) => {
      const path = `teams[${teamIndex}]`;
      if (!team || typeof team !== "object" || Array.isArray(team)) {
        throw new Error(`${path} 必须是对象`);
      }
      ["name", "shortName", "color"].forEach(field =>
        assertNonEmptyString(team[field], `${path}.${field}`)
      );
      if (teamNames.has(team.name)) throw new Error(`${path}.name“${team.name}”重复`);
      teamNames.add(team.name);
      if (!Object.hasOwn(initialScores, team.name) || !Number.isFinite(initialScores[team.name])) {
        throw new Error(`initialScores.${team.name} 必须是已保存的有限数字`);
      }
      if (team.heroColor !== undefined) assertNonEmptyString(team.heroColor, `${path}.heroColor`);
      if (!Array.isArray(team.players) || team.players.length !== 4) {
        throw new Error(`${path}.players 必须恰好包含 4 名选手`);
      }

      const players = team.players.map((player, playerIndex) => {
        assertNonEmptyString(player, `${path}.players[${playerIndex}]`);
        if (playerTeams.has(player)) {
          throw new Error(`选手“${player}”不能同时属于多支队伍`);
        }
        playerTeams.set(player, team.name);
        return player;
      });
      return Object.freeze({
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        initialScore: initialScores[team.name],
        ...(team.heroColor !== undefined ? { heroColor: team.heroColor } : {}),
        players: Object.freeze(players)
      });
    });

    for (const name of Object.keys(initialScores)) {
      if (!teamNames.has(name)) throw new Error(`initialScores 包含未知队伍“${name}”`);
    }
    return Object.freeze({
      teams: Object.freeze(teams),
      playerTeams
    });
  }

  function combineWithGames(teamData, gameData) {
    const teamsByName = new Map(teamData.teams.map(team => [team.name, team]));
    const currentScores = new Map(
        teamData.teams.map(team => [team.name, team.initialScore])
    );
    const values = new Map(teamData.teams.map(team => [team.name, []]));

    const games = gameData.games.map((game, gameIndex) => {
      const gameTeams = new Set();
      const players = game.players.map((player, playerIndex) => {
        const teamName = teamData.playerTeams.get(player.name);
        if (!teamName) {
          throw new Error(`games[${gameIndex}].players[${playerIndex}] 的选手“${player.name}”没有所属队伍`);
        }
        if (gameTeams.has(teamName)) {
          throw new Error(`games[${gameIndex}] 中不能有两名选手来自“${teamName}”`);
        }
        gameTeams.add(teamName);
        const team = teamsByName.get(teamName);
        currentScores.set(teamName, currentScores.get(teamName) + player.teamPoint);
        return Object.freeze({ ...player, team: teamName, teamColor: team.color });
      });

      teamData.teams.forEach(team => values.get(team.name).push(currentScores.get(team.name)));
      return Object.freeze({ ...game, players: Object.freeze(players) });
    });

    const teams = teamData.teams.map(team => Object.freeze({
      ...team,
      values: Object.freeze(values.get(team.name))
    }));
    return Object.freeze({ teams: Object.freeze(teams), games: Object.freeze(games) });
  }

  global.TeamData = Object.freeze({ parseTeamsJson, combineWithGames });
}(globalThis));
