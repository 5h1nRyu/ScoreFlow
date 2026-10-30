import { resolveColor } from "./config.js";


function createMetric(data, theme) {
  const cell = document.createElement("div");
  cell.className = "metric";
  cell.style.gridColumn = `span ${data.columns}`;
  if (data.format === "placements") cell.classList.add("metric--placements");
  cell.dataset.spacing = String(data.spacing);
  for (const [key, color] of Object.entries(data.colors))
    cell.style.setProperty(`--metric-${key}`, resolveColor(color, theme));
  const body = document.createElement("div");
  body.className = "metric-body";
  const label = document.createElement("div");
  label.className = "metric-label";
  label.textContent = data.label;
  const row = document.createElement("div");
  row.className = "metric-value";
  const value = document.createElement("span");
  value.className = "metric-number";
  const firstSeparator = data.value.search(/[-−–]/);
  value.replaceChildren(...Array.from(data.value).map((character, index) => {
    const glyph = document.createElement("span");
    glyph.className = /[%％]/.test(character) ? "metric-suffix"
      : character === "." ? "metric-decimal"
      : /[-−–]/.test(character) ? "metric-separator" : "metric-digit";
    if (/\d/.test(character) && data.format === "placements" && (firstSeparator < 0 || index < firstSeparator))
      glyph.classList.add("metric-accent");
    if (data.characterColors?.[index]) glyph.style.color = resolveColor(data.characterColors[index], theme);
    glyph.textContent = character;
    return glyph;
  }));
  const unit = document.createElement("span");
  unit.className = "metric-unit";
  unit.textContent = data.unit;
  row.append(value, unit);
  body.append(label, row);
  cell.append(body);
  return cell;
}

export function applyContent(config, root = document) {
  const element = (id) => root.getElementById(id);
  const { content, assets, layout, theme } = config;
  const stage = element("stage");
  for (const [key, color] of Object.entries(theme)) stage.style.setProperty(`--${key}`, color);
  stage.style.setProperty("--metric-gap", `${layout.metricGap}px`);
  stage.style.setProperty("--score-caption-size", `${layout.scoreCaptionFontSize}px`);
  stage.style.setProperty("--score-caption-top", `${layout.scoreCaptionTop}px`);
  stage.style.width = `${config.stage.width}px`;
  stage.style.height = `${config.stage.height}px`;
  for (const [id, text] of Object.entries({
    eyebrow: content.label, "score-caption": content.scoreLabel,
    "score-number": content.score, "score-unit": content.unit,
    "metrics-note": content.metricsNote,
  })) element(id).textContent = text;
  element("score-caption").parentElement.hidden = !content.scoreLabel;
  element("score-unit").hidden = !content.unit;
  for (const [id, parent, src] of [["portrait", "portrait-reveal", assets.portrait], ["team-logo", "identity", assets.logo]]) {
    if (src) element(id).src = src;
    else element(id).removeAttribute("src");
    element(parent).hidden = !src;
  }
  for (const [key, src] of [["background-image", assets.background], ["grain-image", assets.grain]])
    stage.style.setProperty(`--${key}`, src ? `url(${JSON.stringify(new URL(src, document.baseURI).href)})` : "none");
  element("team-logo").style.transform = `scale(${layout.logoScale})`;
  element("portrait-motion").style.transformOrigin = layout.portrait.origin;
  const characters = Array.from(content.teamName);
  const split = layout.nameBreakAfter;
  const lines = content.teamName.includes("\n") ? content.teamName.split("\n").map((line) => Array.from(line))
    : split > 0 && split < characters.length ? [characters.slice(0, split), characters.slice(split)] : [characters];
  element("reveal-name").textContent = content.teamName.replace(/\n/g, " ");
  element("team-name").replaceChildren(...lines.map((line) => {
    const row = document.createElement("span");
    row.className = "name-line";
    row.append(...line.map((character) => {
      const glyph = document.createElement("span");
      glyph.className = "name-glyph";
      glyph.textContent = character;
      return glyph;
    }));
    return row;
  }));
  const columns = content.metrics.reduce((sum, data) => sum + data.columns, 0);
  element("metrics").style.gridTemplateColumns = `repeat(${Math.max(1, columns)}, minmax(0, 1fr))`;
  element("metrics").replaceChildren(...content.metrics.map((metric) => createMetric(metric, theme)));
  element("metrics-note").hidden = !content.metricsNote;
  const description = `${content.label}，${content.teamName.replace(/\n/g, "")}，${content.scoreLabel} ${content.score} ${content.unit}。`;
  const metricDescription = content.metrics.map((metric) => `${metric.label} ${metric.value}${metric.unit}`).join("，");
  element("viewport").setAttribute("aria-label", description + (metricDescription ? ` ${metricDescription}。` : ""));
  for (const id of ["label-mask", "team-name", "score-panel", "reveal-name"])
    element(id).hidden = config.text.enabled === false;
  element("metrics-panel").hidden = config.text.enabled === false || content.metrics.length === 0;
}
