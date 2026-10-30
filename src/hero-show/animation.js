const clamp = (x) => Math.max(0, Math.min(1, x));
const outCubic = (x) => 1 - (1 - x) ** 3;
const outQuint = (x) => 1 - (1 - x) ** 5;
const inOutCubic = (x) => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
const mix = (a, b, p) => a + (b - a) * p;

// 所有场景和遮罩都从绝对时间求值，任意 seek、倒放、分段导出结果相同。
export function createAnimation(config, root = document) {
  const ids = ["board", "board-field", "reveal", "reveal-name", "reveal-field", "bridge", "photo-panel", "portrait-reveal", "portrait-motion", "identity", "team-logo", "eyebrow", "header", "score-caption", "score-row", "score-unit"];
  const el = Object.fromEntries(ids.map((id) => [id, root.getElementById(id)]));
  const glyphs = [...root.querySelectorAll(".name-glyph")];
  const metrics = [...root.querySelectorAll(".metric-body")];
  const slices = [...root.querySelectorAll(".wipe-slice")];
  const { timing, layout, ambient } = config;
  const phase = (time, section) => clamp((time - section.start) / section.duration);
  const show = (element, visible) => { element.style.visibility = visible ? "visible" : "hidden"; };
  function render(ms) {
    const time = Math.max(0, Math.min(config.stage.duration, Number(ms) || 0));
    const motion = (section, curve = outCubic) => curve(phase(time, section));
    // 拼合遮满时只切换底层背景，冠军元素等转场完全退场后再入场。
    const sceneSwitch = timing.bridge.start + timing.bridge.enter + timing.bridge.pause;
    show(el.reveal, false);
    show(el.bridge, time >= timing.bridge.start && time < timing.bridge.start + timing.bridge.duration);
    show(el.board, time >= sceneSwitch);
    const intro = clamp(time / timing.bridge.start);
    // 起点与终点各保留半行在画面中，全程匀速左移，不做尾部缓停。
    const flight = phase(time, timing.introText);
    const textWidth = Number(el["reveal-name"].dataset.textWidth) || layout.introMaxWidth;
    el["reveal-name"].style.transform = `translateX(${mix(config.stage.width - textWidth / 2, -textWidth / 2, flight)}px)`;
    el["reveal-field"].style.transform = `translateX(${-intro * 35}px) scale(1.08)`;
    // 交错进入但同时拼合；停顿期间所有片精确归零，之后沿原方向穿出。
    const bridgeTime = time - timing.bridge.start;
    const assembledAt = timing.bridge.start + timing.bridge.enter;
    const splitAt = assembledAt + timing.bridge.pause;
    slices.forEach((slice, index) => {
      const delay = index * timing.bridge.stagger;
      const entering = time >= assembledAt ? 1 : clamp((bridgeTime - delay) / (timing.bridge.enter - delay));
      const exiting = clamp((time - splitAt - delay) / (timing.bridge.exit - delay));
      const y = (1 - entering) * 1700 - exiting * 1700;
      slice.style.transform = `translateY(${(index % 2 ? -1 : 1) * y}px) skewX(-22deg)`;
    });
    const panel = motion(timing.panel, inOutCubic);
    el["photo-panel"].style.clipPath = `polygon(${mix(96, 12, panel)}% 0,100% 0,100% 100%,${mix(84, 0, panel)}% 100%)`;
    el["photo-panel"].style.transform = `translateX(${(1 - panel) * 120}px)`;
    const portrait = motion(timing.portrait, outQuint);
    el["portrait-reveal"].style.clipPath = `inset(0 0 0 ${(1 - portrait) * 100}%)`;
    el["portrait-motion"].style.transform = `translate(${layout.portrait.x + (1 - portrait) * 540}px,${layout.portrait.y}px) scale(${layout.portrait.scale * (1 + (1 - portrait) * 0.08)})`;
    // 队徽在独立正方形区域内揭幕，完整等比容纳不同形状的替换素材。
    const identity = motion(timing.identity, outQuint);
    el.identity.style.clipPath = `inset(0 0 ${(1 - identity) * 100}% 0)`;
    el.identity.style.transform = `translateY(${(1 - identity) * -45}px)`;
    el["team-logo"].style.transform = `translateY(${(1 - identity) * 70}px) scale(${layout.logoScale})`;
    const label = motion(timing.label);
    el.eyebrow.style.transform = `translateY(${(1 - label) * 100}%)`;
    el.header.style.clipPath = `inset(0 ${(1 - label) * 100}% 0 0)`;
    glyphs.forEach((glyph, index) => {
      const p = motion({ ...timing.name, start: timing.name.start + index * timing.name.stagger }, outQuint);
      glyph.style.transform = `translateY(${(1 - p) * 115}%)`;
    });
    const score = motion(timing.score, outQuint);
    el["score-caption"].style.transform = `translateY(${(1 - score) * 108}%)`;
    el["score-row"].style.transform = `translateY(${(1 - score) * 108}%)`;
    el["score-unit"].style.opacity = String(motion(timing.unit));
    metrics.forEach((metric, index) => {
      const p = motion({ ...timing.metrics, start: timing.metrics.start + index * timing.metrics.stagger }, outQuint);
      metric.style.transform = `translateY(${(1 - p) * 115}%)`;
    });
    const a = ambient.enabled ? Math.sin(Math.max(0, time - ambient.start) / ambient.period * Math.PI * 2) : 0;
    el["board-field"].style.transform = `translate(${a * ambient.travel}px,${a * 5}px) scale(1.08)`;
    return time;
  }
  return { render, duration: config.stage.duration };
}
