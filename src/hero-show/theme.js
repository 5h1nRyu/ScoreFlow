// CSS color-mix 保留任意合法 CSS 队伍颜色，所有特征色派生规则由公共配置提供。
export function createTeamTheme(neutralTheme, team, transforms) {
  const base = team.heroColor ?? team.color;
  const validColor = color => typeof color === "string" && color.trim()
    && (typeof CSS === "undefined" || CSS.supports("color", color));
  if (!validColor(base)) throw new Error(`队伍“${team.name}”的 heroColor / color 不是有效颜色`);
  const theme = { ...neutralTheme };
  for (const [key, rule] of Object.entries(transforms)) {
    if (!validColor(rule.mix) || !Number.isFinite(rule.amount) || rule.amount < 0 || rule.amount > 1
        || (rule.alpha !== undefined && (!Number.isFinite(rule.alpha) || rule.alpha < 0 || rule.alpha > 1))) {
      throw new Error(`特写颜色变换 ${key} 无效`);
    }
    const color = rule.amount === 0 ? base
      : `color-mix(in srgb, ${base} ${(1 - rule.amount) * 100}%, ${rule.mix} ${rule.amount * 100}%)`;
    theme[key] = rule.alpha === undefined ? color
      : `color-mix(in srgb, ${color} ${rule.alpha * 100}%, transparent)`;
  }
  return theme;
}
