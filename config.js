// 项目公共配置。后续的可配置项统一添加到此对象中。
const APP_CONFIG = Object.freeze({
  backgroundColor: "#ffffff",

  layout: Object.freeze({
    // 纵向分隔位置：0.7 表示左侧占页面宽度的 70%。
    verticalSplit: 0.7,
    // 横向分隔位置：0.7 表示上方占页面高度的 70%。
    horizontalSplit: 0.8,
    divider: Object.freeze({
      // 默认隐藏分隔线；布局仍然保持四区域结构。
      visible: true,
      // 分隔线粗细（CSS 像素）。
      thickness: 1,
      color: "rgba(28, 30, 25, 0.35)"
    })
  }),

  animation: Object.freeze({
    // 每场比赛对应的动画时长（毫秒）。
    matchDuration: 1150,
    // 单帧参与缩放计算的最大时间间隔（秒）。
    maximumFrameDelta: 0.05,
    // 最后一场结束后停留多久，再从 match0 重新播放（毫秒）。
    restartDelay: 3000
  }),

  // 队伍属性和每场比赛的累计总分都从此 CSV 读取。
  dataUrl: "scores.csv",

  chart: Object.freeze({
    // X 轴同时显示的比赛数量。
    windowSize: 10
  }),

  labels: Object.freeze({
    // 是否在每条折线的末端显示队伍名称。
    enabled: true,
    // 标签字号（CSS 像素）。
    fontSize: 16,
    // 标签字重，可使用 100–900 或 "bold" 等 Canvas 字体权重。
    fontWeight: 700,
    // 标签与折线末端圆点的水平间距。
    horizontalGap: 10,
    // 标签之间的额外垂直间距。
    verticalGap: 4
  }),

  yAxis: Object.freeze({
    // 动态计算出的 Y 轴范围下限。
    minimumRange: 20,
    // 为最高分数额外预留的显示空间倍率。
    paddingFactor: 1.12,
    // Y 轴期望显示的主刻度数量。
    targetMajorTickCount: 8,
    // Y 轴扩张时的平滑调整速率。
    expansionRate: 10,
    // Y 轴收缩时的平滑调整速率。
    contractionRate: 1.8
  })
});

// 将背景颜色提供给样式表使用。
document.documentElement.style.setProperty(
    "--background-color",
    APP_CONFIG.backgroundColor
);
