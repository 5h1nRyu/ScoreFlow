// 集中管理项目公共配置
const APP_CONFIG = Object.freeze({
  backgroundColor: "#ffffff",

  layout: Object.freeze({
    // 纵向分隔位置为 0.7 时左侧占页面宽度的 70%
    verticalSplit: 0.7,
    // 横向分隔位置为 0.7 时上方占页面高度的 70%
    horizontalSplit: 0.8,
    divider: Object.freeze({
      // 控制分隔线显示且不影响四区域布局
      visible: true,
      // 设置分隔线的 CSS 像素粗细
      thickness: 1,
      color: "rgba(28, 30, 25, 0.35)"
    })
  }),

  animation: Object.freeze({
    // 设置每场比赛对应的动画毫秒数
    matchDuration: 1150,
    // 限制单帧参与缩放计算的最大秒数
    maximumFrameDelta: 0.05,
    // 设置结束时将 X 轴展开至完整比赛范围的动画毫秒数
    overviewDuration: 1500,
    // 设置最后一场结束后重新播放前的停留毫秒数
    restartDelay: 3000
  }),

  // 指定队伍属性和累计总分的数据文件
  dataUrl: "data/scores.csv",

  chart: Object.freeze({
    // 设置 X 轴同时显示的比赛数量
    windowSize: 10
  }),

  labels: Object.freeze({
    // 控制折线末端的队伍名称显示
    enabled: true,
    // 设置标签字号的 CSS 像素值
    fontSize: 16,
    // 设置 Canvas 支持的标签字重
    fontWeight: 700,
    // 设置标签与折线末端圆点的水平间距
    horizontalGap: 10,
    // 设置标签之间的额外垂直间距
    verticalGap: 4
  }),

  yAxis: Object.freeze({
    // 限制动态 Y 轴范围的下限
    minimumRange: 20,
    // 设置最高分数之外的显示空间倍率
    paddingFactor: 1.12,
    // 设置 Y 轴期望显示的主刻度数量
    targetMajorTickCount: 8,
    // 设置 Y 轴扩张时的平滑调整速率
    expansionRate: 10,
    // 设置 Y 轴收缩时的平滑调整速率
    contractionRate: 1.8
  })
});
