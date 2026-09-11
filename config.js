// 项目公共配置。后续的可配置项统一添加到此对象中。
const APP_CONFIG = Object.freeze({
  backgroundColor: "#ffffff",

  animation: Object.freeze({
    // 每场比赛对应的动画时长（毫秒）。
    matchDuration: 1150,
    // 单帧参与缩放计算的最大时间间隔（秒）。
    maximumFrameDelta: 0.05
  }),

  chart: Object.freeze({
    // X 轴同时显示的比赛数量。
    windowSize: 12
  }),

  teams: Object.freeze({
    // 各队伍曲线使用的颜色。
    colors: Object.freeze([
      "#cf3f27", "#126783", "#ce9215", "#39714e", "#745087",
      "#db655d", "#59666e", "#718a31", "#30467d", "#ae6220"
    ]),
    // 每支队伍的初始分数。
    initialScore: 0
  }),

  yAxis: Object.freeze({
    // Y 轴初始显示的上下范围。
    initialRange: 60,
    // 动态计算出的 Y 轴范围下限。
    minimumRange: 20,
    // 计算可见峰值时采用的最小值。
    minimumPeak: 8,
    // 为最高分数额外预留的显示空间倍率。
    paddingFactor: 1.12,
    // Y 轴期望显示的主刻度数量。
    targetMajorTickCount: 8,
    // Y 轴扩张时的平滑调整速率。
    expansionRate: 6,
    // Y 轴收缩时的平滑调整速率。
    contractionRate: 1.8
  })
});

// 将背景颜色提供给样式表使用。
document.documentElement.style.setProperty(
    "--background-color",
    APP_CONFIG.backgroundColor
);
