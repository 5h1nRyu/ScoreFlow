(function exposeMatchData(global) {
  "use strict";

  const REQUIRED_PLAYER_FIELDS = Object.freeze([
    "name", "team", "score", "teamPoint", "riichiCount", "winCount", "dealInCount"
  ]);

  function assertNonEmptyString(value, path) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${path} 必须是非空字符串`);
    }
  }

  function assertFiniteNumber(value, path) {
    if (!Number.isFinite(value)) throw new Error(`${path} 必须是有限数字`);
  }

  function validatePlayer(player, path) {
    if (!player || typeof player !== "object" || Array.isArray(player)) {
      throw new Error(`${path} 必须是对象`);
    }
    REQUIRED_PLAYER_FIELDS.forEach(field => {
      if (!(field in player)) throw new Error(`${path}.${field} 缺失`);
    });
    assertNonEmptyString(player.name, `${path}.name`);
    assertNonEmptyString(player.team, `${path}.team`);
    ["score", "teamPoint", "riichiCount", "winCount", "dealInCount"].forEach(field => {
      assertFiniteNumber(player[field], `${path}.${field}`);
    });
    ["riichiCount", "winCount", "dealInCount"].forEach(field => {
      if (!Number.isInteger(player[field]) || player[field] < 0) {
        throw new Error(`${path}.${field} 必须是大于或等于 0 的整数`);
      }
    });
    return Object.freeze({
      name: player.name,
      team: player.team,
      score: player.score,
      teamPoint: player.teamPoint,
      riichiCount: player.riichiCount,
      winCount: player.winCount,
      dealInCount: player.dealInCount
    });
  }

  function validateGame(game, path) {
    if (!game || !Array.isArray(game.players) || game.players.length !== 4) {
      throw new Error(`${path}.players 必须恰好包含 4 名选手`);
    }
    return Object.freeze({
      players: Object.freeze(game.players.map((player, index) =>
        validatePlayer(player, `${path}.players[${index}]`)
      ))
    });
  }

  function parseMatchesJson(text) {
    let source;
    try {
      source = JSON.parse(text);
    } catch (error) {
      throw new Error(`比赛数据不是有效 JSON：${error.message}`);
    }
    if (!source || !Array.isArray(source.matches) || !source.matches.length) {
      throw new Error("比赛数据必须包含非空的 matches 数组");
    }

    const matches = source.matches.map((match, index) => {
      const path = `matches[${index}]`;
      if (!match || typeof match !== "object" || !Number.isInteger(match.matchId)) {
        throw new Error(`${path}.matchId 必须是整数`);
      }
      return Object.freeze({
        matchId: match.matchId,
        gameA: validateGame(match.gameA, `${path}.gameA`),
        gameB: validateGame(match.gameB, `${path}.gameB`)
      });
    });

    return Object.freeze({ matches: Object.freeze(matches) });
  }

  global.MatchData = Object.freeze({ parseMatchesJson });
}(globalThis));
