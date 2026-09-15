// 集中管理项目公共配置
const APP_CONFIG = Object.freeze({
  backgroundColor: "#ffffff",

  layout: Object.freeze({
    // 纵向分隔位置为 0.7 时左侧占页面宽度的 70%
    verticalSplit: 0.75,
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
    // 设置每个 game 对应的动画毫秒数
    gameDuration: 2000,
    // 限制单帧参与缩放计算的最大秒数
    maximumFrameDelta: 0.05,
    // 设置结束时将 X 轴展开至完整比赛范围的动画毫秒数
    overviewDuration: 1500,
    // 设置最后一场结束后重新播放前的停留毫秒数
    restartDelay: 3000
  }),

  // 指定队伍、队员归属和初始分数的数据文件
  teamsDataUrl: "data/teams.json",
  // 指定每个 game 的选手数据文件
  gamesDataUrl: "data/games.json",

  gameTable: Object.freeze({
    // 八名选手按照相邻两个 game 各自从上到下的顺序依次切换
    rowTransitionDuration: 220,
    rowTransitionDelay: 35,
    // 设置单个选手条目高度与 game-table 区域高度的比例
    itemHeightRatio: 0.08,
    // 设置同一场比赛中相邻选手条目间距与 game-table 区域高度的比例
    itemGapRatio: 0.016,
    // 设置选手头像高度与条目高度的比例；大于 1 时头像可超出条目
    playerImageHeightRatio: 1.2,
    // 设置总分区域与条目右端的距离，单位为 CSS 像素
    totalScoreRightGap: 8,
    // 设置选手条目内各类文字的字号，单位为 CSS 像素
    itemFontSizes: Object.freeze({
      playerName: 36,
      totalScore: 36,
      convertedTeamScore: 20,
      stat: 28
    }),
    playerImageBaseUrl: "assets/images/players",
    teamImageBaseUrl: "assets/images/teams"
  }),

  chart: Object.freeze({
    // 设置 X 轴同时显示的 game 数量
    windowSize: 6,
    // 设置所有屏幕尺寸下的积分折线粗细
    lineThickness: 6
  }),

  xAxis: Object.freeze({
    // 全景阶段期望显示的竖直网格线数量
    overviewTargetGridLineCount: 12,
    gridLine: Object.freeze({
      // 设置竖直网格虚线的粗细、线段长度和间隔长度
      thickness: 1.3,
      dashLength: 3,
      dashGap: 6
    })
  }),

  labels: Object.freeze({
    // 控制折线末端的队伍名称显示
    enabled: true,
    // 设置标签字号的 CSS 像素值
    fontSize: 24,
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
    contractionRate: 1.8,
    gridLines: Object.freeze({
      zero: Object.freeze({
        // 零分线默认保持实线；将两个虚线参数改为正数即可显示为虚线
        thickness: 2.4,
        dashLength: 0,
        dashGap: 0
      }),
      major: Object.freeze({
        // 设置主刻度水平虚线的粗细、线段长度和间隔长度
        thickness: 1.6,
        dashLength: 4,
        dashGap: 5
      }),
      minor: Object.freeze({
        // 设置次刻度水平虚线的粗细、线段长度和间隔长度
        thickness: 1.1,
        dashLength: 2,
        dashGap: 6
      })
    })
  })
});
