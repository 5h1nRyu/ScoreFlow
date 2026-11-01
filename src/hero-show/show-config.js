// 公共视觉设置：月度文字、指标数值、合影和队标在 data/months/<年月>/month.json。
export const SHOW_DEFAULTS = {
  assets: {
    background: "../../assets/hero-show/images/instrument-grid.svg", // 留空隐藏纹理。
    grain: "../../assets/hero-show/images/grain.svg",
    fonts: {
      title: { src: "../../assets/font/NotoSansSC-Variable.ttf", weight: 900 },
      score: { src: "../../assets/hero-show/fonts/score-extrabold.ttf", weight: 800 },
    }, // 字体 src 留空使用系统字体；替换字体时一并保留相应许可证。
  },
  layout: {
    nameBreakAfter: 2,
    nameFontSize: 100,
    scoreFontSize: 250,
    labelFontSize: 68,
    scoreCaptionFontSize: 30,
    scoreCaptionTop: -6,
    metricFontSize: 92,
    metricLabelFontSize: 24,
    metricGap: 46,
    introFontSize: 380,
    introMaxWidth: 2850,
    portrait: { x: 0, y: 0, scale: 1, origin: "50% 50%" },
    logoScale: 0.84,
  },
  // 以队伍 heroColor（缺省使用 color）为基础，与目标色按比例混合。
  teamColorTransforms: {
    accent: { mix: "#FFFFFF", amount: 0 },
    panel: { mix: "#FFFFFF", amount: 0.32 },
    panelLight: { mix: "#FFFFFF", amount: 0.58 },
    panelGlow: { mix: "#FFFFFF", amount: 0, alpha: 0.467 },
  },
  metricFormats: {
    placements: { columns: 2, colors: { first: "accent" } },
  },
  theme: {
    paper: "#ECE5D6", ink: "#191919",
    scoreCaption: "#000000",
    data: "#201E1C", dataInk: "#FFFFFF", dataMuted: "#BDB2AA",
    bridgeStart: "#E9E0D3", bridgeMiddle: "#F0E8DC", bridgeEnd: "#ECE3D6",
  },
  // 每项指标可覆盖这些颜色；可用 theme 中的键名或 CSS 颜色。
  metricStyle: {
    spacing: 0.5, // placements 中字符可用间隙的比例，0 紧排，1 铺满当前列。
    colors: {
      label: "dataInk", number: "dataInk", decimal: "dataInk",
      separator: "dataInk", suffix: "accent", unit: "accent", first: "dataInk",
    },
  },
  motion: { // 毫秒；开始时间、入场完成时间和总时长由程序计算。
    intro: 443.1,
    bridge: { enter: 330, pause: 120, exit: 330, stagger: 15 },
    entrance: {
      panel: { offset: 0, duration: 360 },
      identity: { offset: 0, duration: 480 },
      label: { offset: 0, duration: 300 },
      portrait: { offset: 70, duration: 500 },
      name: { offset: 97, duration: 340, stagger: 25 },
      score: { offset: 227, duration: 350 },
      unit: { offset: 307, duration: 300 },
      metrics: { offset: 197, duration: 260, stagger: 40 },
    },
    settle: 30,
    hold: 5000,
  },
  text: { enabled: true },
  ambient: { enabled: true, period: 12000, travel: 16 },
};
