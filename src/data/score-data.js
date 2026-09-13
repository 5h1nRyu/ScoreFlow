(function exposeScoreData(global) {
  "use strict";

  // 将 CSV 文本解析为支持引号转义的二维数组
  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (quoted) {
      throw new Error("CSV 中存在未闭合的双引号");
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // 忽略不包含有效字段的空行
    return rows.filter(cells => cells.some(cell => cell.trim() !== ""));
  }

  // 校验积分数据并转换为按队伍组织的结构
  function parseScoreCsv(text) {
    const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));

    if (rows.length === 0) {
      throw new Error("CSV 不能为空");
    }

    const teamCount = rows[0].length - 1;
    if (teamCount < 1) {
      throw new Error("CSV 至少需要一支队伍");
    }

    const properties = Object.create(null);
    const matches = [];
    let reachedMatches = false;

    // 属性行必须位于连续的比赛行之前
    rows.forEach((cells, rowIndex) => {
      const line = rowIndex + 1;
      if (cells.length !== teamCount + 1) {
        throw new Error(`CSV 第 ${line} 行应有 ${teamCount + 1} 列，实际为 ${cells.length} 列`);
      }

      const key = cells[0].trim();
      const values = cells.slice(1).map(value => value.trim());
      const matchResult = /^match(\d+)$/.exec(key);

      if (matchResult) {
        reachedMatches = true;
        const matchIndex = Number(matchResult[1]);
        if (matchIndex !== matches.length) {
          throw new Error(`CSV 比赛行必须从 match0 开始连续排列，此处应为 match${matches.length}`);
        }
        matches.push(values.map((value, teamIndex) => {
          const score = Number(value);
          if (value === "" || !Number.isFinite(score)) {
            throw new Error(`match${matchIndex} 中第 ${teamIndex + 1} 支队伍的分数无效`);
          }
          return score;
        }));
        return;
      }

      if (reachedMatches) {
        throw new Error(`属性行“${key || "(空)"}”必须位于所有 match 行之前`);
      }
      if (!key) {
        throw new Error(`CSV 第 ${line} 行的属性名不能为空`);
      }
      if (Object.hasOwn(properties, key)) {
        throw new Error(`CSV 属性“${key}”重复`);
      }
      properties[key] = values;
    });

    ["name", "color"].forEach((key) => {
      if (!Object.hasOwn(properties, key)) {
        throw new Error(`CSV 缺少必需属性“${key}”`);
      }
      if (properties[key].some(value => value === "")) {
        throw new Error(`CSV 必需属性“${key}”不能包含空值`);
      }
    });

    if (matches.length === 0) {
      throw new Error("CSV 至少需要 match0 行");
    }

    // 将按行存储的数据转换为每支队伍的时间序列
    const teams = Array.from({ length: teamCount }, (_, index) => {
      const attributes = Object.fromEntries(
          Object.entries(properties).map(([key, values]) => [key, values[index]])
      );
      return { ...attributes, values: matches.map(scores => scores[index]) };
    });

    return { properties, matches, teams };
  }

  global.ScoreData = Object.freeze({ parseScoreCsv });
}(globalThis));
