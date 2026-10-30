import { SHOW_CONFIG } from "./show-config.js";
import { createConfig } from "./config.js";
import { createAnimation } from "./animation.js";
import { applyContent } from "./content.js";
import { fitText } from "./layout.js";
import { loadResources } from "./resources.js";
import { MARKUP } from "./markup.js";

// Resolve asset paths from this module, including under GitHub Pages subpaths.
const source = structuredClone(SHOW_CONFIG);
for (const key of ["portrait", "logo", "background", "grain"]) {
  if (source.assets[key]) source.assets[key] = new URL(source.assets[key], import.meta.url).href;
}
for (const font of Object.values(source.assets.fonts)) {
  if (font.src) font.src = new URL(font.src, import.meta.url).href;
}
const config = createConfig(source);
const startMs = config.timing.bridge.start;
export const durationMs = config.stage.duration - startMs;

// ScoreFlow owns playback, looping, pausing and video export. This component
// only evaluates the original HeroShow wipe and board at the supplied time.
export async function createHeroShow(host) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.innerHTML = MARKUP;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./styles.css", import.meta.url).href;
  const stylesReady = new Promise((resolve, reject) => {
    stylesheet.onload = resolve;
    stylesheet.onerror = () => reject(new Error("HeroShow 样式加载失败"));
  });
  root.prepend(stylesheet);
  const stage = root.getElementById("stage");
  const viewport = root.getElementById("viewport");
  const grain = root.querySelector(".grain");
  const bridge = root.getElementById("bridge");
  const dashboard = document.getElementById("dashboard");
  const animation = createAnimation(config, root);
  const sceneSwitch = config.timing.bridge.enter + config.timing.bridge.pause;
  host.hidden = false;
  host.style.opacity = "0";
  try {
    applyContent(config, root);
    await Promise.all([stylesReady, loadResources(config, stage)]);
    fitText(config, root);
    stage.classList.add("ready");
  } catch (error) {
    host.hidden = true;
    host.style.opacity = "";
    root.replaceChildren();
    throw error;
  }
  host.hidden = true;
  host.style.opacity = "";
  return Object.freeze({
    durationMs,
    render(state) {
      host.hidden = !state.heroActive;
      const boardVisible = state.heroActive && state.heroElapsed >= sceneSwitch;
      dashboard.setAttribute("aria-hidden", String(boardVisible));
      if (!state.heroActive) return;
      const width = host.clientWidth, height = host.clientHeight;
      const scale = Math.min(width / config.stage.width, height / config.stage.height);
      stage.style.left = `${(width - config.stage.width * scale) / 2}px`;
      stage.style.top = `${(height - config.stage.height * scale) / 2}px`;
      stage.style.transform = `scale(${scale})`;
      // The board keeps its design ratio; the wipe covers the entire viewport.
      bridge.style.transform = `scale(${width / (config.stage.width * scale)},${height / (config.stage.height * scale)})`;
      // Until the strips assemble, the original score overview remains visible.
      viewport.style.background = boardVisible ? config.theme.paper : "transparent";
      grain.style.visibility = boardVisible ? "visible" : "hidden";
      animation.render(startMs + state.heroElapsed);
    },
    destroy() {
      host.hidden = true;
      dashboard.removeAttribute("aria-hidden");
      root.replaceChildren();
    },
  });
}
