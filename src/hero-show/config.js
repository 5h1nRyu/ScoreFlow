// 无 DOM 依赖：校验配置并推导绝对时间轴，浏览器、测试和预览脚本共用。
function number(value, name, minimum = 0, exclusive = false) {
  if (!Number.isFinite(value) || (exclusive ? value <= minimum : value < minimum))
    throw new Error(`配置 ${name} 必须为${exclusive ? "大于" : "不小于"} ${minimum} 的有限数字`);
  return value;
}

export function createConfig(source) {
  const config = structuredClone(source);
  const { content, assets, layout, motion, metricStyle, theme } = config;
  if (!content || !assets || !layout || !motion || !metricStyle || !theme)
    throw new Error("配置缺少 content、assets、layout、motion、metricStyle 或 theme");
  for (const key of ["label", "scoreLabel", "score", "unit", "metricsNote"]) {
    if (content[key] === undefined) content[key] = "";
    if (!["string", "number"].includes(typeof content[key])) throw new Error(`配置 content.${key} 必须为文字或数字`);
    content[key] = String(content[key]);
  }
  if (!Array.isArray(content.teamName) || content.teamName.length !== 2
      || !content.teamName.every(line => typeof line === "string" && line.trim() && !/[\r\n]/.test(line)))
    throw new Error("配置 content.teamName 必须分别提供两行非空文字，例如 [\"科乐美麻将\", \"格斗俱乐部\"]");
  if (!Array.isArray(content.metrics)) throw new Error("配置 content.metrics 必须为数组");
  content.metrics = content.metrics.map((metric, index) => {
    const name = `content.metrics[${index}]`;
    if (!metric || typeof metric !== "object") throw new Error(`配置 ${name} 必须为对象`);
    const columns = metric.columns ?? 1;
    if (!Number.isInteger(columns) || columns < 1) throw new Error(`配置 ${name}.columns 必须为正整数`);
    const format = metric.format ?? "number";
    if (!["number", "placements"].includes(format)) throw new Error(`配置 ${name}.format 仅支持 number 或 placements`);
    const spacing = metric.spacing ?? metricStyle.spacing;
    number(spacing, `${name}.spacing`);
    if (spacing > 1) throw new Error(`配置 ${name}.spacing 不能超过 1`);
    return {
      ...metric, label: String(metric.label ?? ""), value: String(metric.value ?? ""),
      unit: String(metric.unit ?? ""), columns, format, spacing,
      colors: { ...metricStyle.colors, ...metric.colors },
    };
  });
  for (const key of ["portrait", "logo", "background", "grain", "favicon"]) {
    assets[key] ??= "";
    if (typeof assets[key] !== "string") throw new Error(`配置 assets.${key} 必须为资源路径字符串`);
  }
  for (const key of ["title", "score"]) {
    const font = assets.fonts?.[key];
    if (font && typeof font.src !== "string") throw new Error(`配置 assets.fonts.${key}.src 必须为字符串`);
    if (font?.src) number(font.weight, `assets.fonts.${key}.weight`, 0, true);
  }
  for (const key of ["nameFontSize", "scoreFontSize", "labelFontSize", "scoreCaptionFontSize", "metricFontSize", "metricLabelFontSize", "introFontSize", "introMaxWidth", "logoScale"])
    number(layout[key], `layout.${key}`, 0, true);
  number(layout.metricGap, "layout.metricGap");
  if (!Number.isFinite(layout.scoreCaptionTop)) throw new Error("配置 layout.scoreCaptionTop 必须为有限数字");
  for (const key of ["x", "y"]) if (!Number.isFinite(layout.portrait[key])) throw new Error(`配置 layout.portrait.${key} 必须为有限数字`);
  number(layout.portrait.scale, "layout.portrait.scale", 0, true);
  number(config.ambient.period, "ambient.period", 0, true);
  number(config.ambient.travel, "ambient.travel");
  number(motion.intro, "motion.intro", 0, true);
  for (const key of ["enter", "exit"]) number(motion.bridge[key], `motion.bridge.${key}`, 0, true);
  for (const key of ["pause", "stagger"]) number(motion.bridge[key], `motion.bridge.${key}`);
  if (motion.bridge.stagger * 4 >= Math.min(motion.bridge.enter, motion.bridge.exit))
    throw new Error("配置 motion.bridge.stagger 过大，最后一块斜片必须保留运动时间");
  number(motion.settle, "motion.settle");
  number(motion.hold, "motion.hold", 0, true);
  const bridge = { start: motion.intro, ...motion.bridge };
  bridge.duration = bridge.enter + bridge.pause + bridge.exit;
  const boardStart = bridge.start + bridge.duration;
  const timing = { introText: { start: 0, duration: motion.intro }, bridge };
  const counts = { name: Array.from(content.teamName.join("")).length, metrics: content.metrics.length };
  const sections = ["panel", "identity", "label", "portrait", "name", "score", "unit", "metrics"];
  let entranceEnd = boardStart;
  for (const key of sections) {
    const section = motion.entrance[key];
    if (!section) throw new Error(`配置缺少 motion.entrance.${key}`);
    number(section.offset, `motion.entrance.${key}.offset`);
    number(section.duration, `motion.entrance.${key}.duration`, 0, true);
    number(section.stagger ?? 0, `motion.entrance.${key}.stagger`);
    timing[key] = { start: boardStart + section.offset, duration: section.duration, stagger: section.stagger ?? 0 };
    entranceEnd = Math.max(entranceEnd, timing[key].start + section.duration + Math.max(0, (counts[key] ?? 1) - 1) * timing[key].stagger);
  }
  const displayStart = entranceEnd + motion.settle;
  timing.board = { start: boardStart, duration: displayStart - boardStart };
  timing.hold = { start: displayStart, duration: motion.hold };
  config.timing = timing;
  // 固定设计画布，外层负责缩放；导出支持在此视口下输出 1080p / 4K。
  config.stage = { width: 1920, height: 1080, duration: displayStart + motion.hold };
  config.ambient.start = displayStart;
  return config;
}

export const resolveColor = (color, theme) => theme[color] ?? color;
