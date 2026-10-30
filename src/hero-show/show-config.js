// 复用入口：文字、数据、素材路径和视觉设置都在这里修改。
// 素材路径相对于当前 show-config.js 文件；数值字符串会原样展示，不自动计算或补单位。
export const SHOW_CONFIG = {
  content: {
    label: "九月队伍积分冠军",
    teamName: "角川樱花骑士", // 支持 \n 手动换行；不换行时使用 layout.nameBreakAfter。
    scoreLabel: "月间队伍得分",
    score: "+197.2",
    unit: "PT",
    metricsNote: "", // 留空隐藏说明。
    metrics: [
      {
        label: "月间顺位统计", value: "6-2-2-2", unit: "",
        format: "placements", columns: 2, spacing: 0.5,
        colors: { first: "accent" },
      },
      { label: "平均顺位", value: "2.00", unit: "" },
      { label: "一位率", value: "50.00%", unit: "" },
      { label: "避四率", value: "83.33%", unit: "" },
    ],
  },
  assets: {
    portrait: "../../assets/hero-show/images/player.png", // 留空隐藏合影。
    logo: "../../assets/hero-show/images/team-logo.png", // 留空隐藏队徽。
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
  theme: {
    paper: "#ECE5D6", ink: "#191919", panel: "#F0B6CC",
    panelLight: "#F5D3DF", panelGlow: "#EF92AE77",
    accent: "#EF92AE", scoreCaption: "#000000",
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
