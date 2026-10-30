// 在字体准备完毕后测量布局；不读取动画 transform，保证 seek 与导出稳定。

function fitFont(target, maximum, fits) {
  target.style.fontSize = `${maximum}px`;
  if (fits()) return;
  let low = 1, high = maximum;
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    target.style.fontSize = `${middle}px`;
    if (fits()) low = middle;
    else high = middle;
  }
  target.style.fontSize = `${low * 0.998}px`;
}

export function fitText({ layout }, root = document) {
  const element = (id) => root.getElementById(id);
  const heading = element("team-name");
  fitFont(heading, layout.nameFontSize, () =>
    heading.offsetHeight <= 250 && [...heading.children].every((row) =>
      row.scrollWidth <= heading.clientWidth && [...row.children].reduce((sum, glyph) => sum + glyph.offsetWidth, 0) <= heading.clientWidth),
  );
  fitFont(element("score-number"), layout.scoreFontSize, () => element("score-row").offsetWidth <= element("score-panel").clientWidth - 1);
  const label = element("eyebrow");
  fitFont(label, layout.labelFontSize, () => label.scrollWidth <= label.clientWidth);
  const caption = element("score-caption");
  fitFont(caption, layout.scoreCaptionFontSize, () => caption.scrollWidth <= element("score-panel").clientWidth - 4);
  root.querySelectorAll(".metric").forEach((cell) => {
    const value = cell.querySelector(".metric-number");
    const row = cell.querySelector(".metric-value");
    value.style.setProperty("--placement-gap", "0px");
    fitFont(value, layout.metricFontSize, () => row.scrollWidth <= cell.clientWidth - 12);
    if (cell.classList.contains("metric--placements")) {
      const glyphs = [...value.children];
      const glyphWidth = glyphs.reduce((sum, glyph) => sum + parseFloat(getComputedStyle(glyph).width), 0);
      const gap = Math.max(0, value.clientWidth - glyphWidth) / Math.max(1, glyphs.length - 1) * Number(cell.dataset.spacing);
      value.style.setProperty("--placement-gap", `${gap}px`);
    }
    const metricLabel = cell.querySelector(".metric-label");
    fitFont(metricLabel, layout.metricLabelFontSize, () => metricLabel.scrollWidth <= cell.clientWidth);
  });
  const introName = element("reveal-name");
  fitFont(introName, layout.introFontSize, () => introName.scrollWidth <= layout.introMaxWidth);
  introName.dataset.textWidth = String(introName.scrollWidth);
}
