// 全景阶段由队伍表的四个连续阶段共同组成。
const OVERVIEW_PHASES = Object.freeze({
  teamTableEnterDuration: 1000,
  initialHoldDuration: 2000,
  reorderDuration: 1000,
  finalHoldDuration: 3000
});
const OVERVIEW_DURATION = Object.values(OVERVIEW_PHASES)
    .reduce((total, duration) => total + duration, 0);

// 集中管理项目公共配置
const APP_CONFIG = Object.freeze({
  // NASA-punk 机身底色；旧纸张背景仍可通过开关启用。
  useBackgroundImage: false,
  backgroundColor: "#ECE5D6",

  layout: Object.freeze({
    // 页面外围留白分别相对于视口宽度和高度计算
    pageMargin: Object.freeze({ horizontal: 0.025, top: 0.025, bottom: 0.055 }),
    // 页面主体按标题和图表区从上到下紧凑排列
    rows: Object.freeze({ title: 0.145, chart: 0.775 }),
    // 比赛表与队伍表共用固定宽度；折线图使用扣除左右边距和表格后的空间
    // 列间距包含在折线图区内，不额外占用页面宽度
    chartColumns: Object.freeze({ dataTable: 0.29 })
  }),

  title: Object.freeze({
    text: "M.LEAGUE 2026-2027赛季 9月 队伍积分演变",
    fontSize: 60,
    // 中西文可变字体均支持 100–900；900 使用真实 Black 字重，字号按 CSS 像素直接生效。
    fontWeight: 900
  }),

  animation: Object.freeze({
    // 每轮开始时仅隐藏数据内容的时长；标题与面板装饰保持显示，0 表示跳过
    backgroundHoldDuration: 1000,
    // 折线图与首组比赛数据整体同步淡入的时长；主标题始终显示，0 表示立即显示
    entranceDuration: 2000,
    // 设置每个 game 对应的动画毫秒数
    gameDuration: 1500,
    // 限制单帧参与缩放计算的最大秒数
    maximumFrameDelta: 0.05,
    // 比赛表退场结束后才开始队伍表进场，期间布局宽度保持不变；0 表示立即切换
    gameTableExitDuration: 400,
    // 四段时长之和作为完整的队伍表总览阶段时间
    overview: OVERVIEW_PHASES,
    overviewDuration: OVERVIEW_DURATION,
    // 设置最后一场结束后重新播放前的停留毫秒数
    restartDelay: 3000
  }),

  debug: Object.freeze({
    // 显示布局区域与表格内容列的调试边框，不影响实际布局尺寸
    showLayoutBorders: false,
    // -1 使用完整数据；正整数 x 只演示到 gameId 为 x 的 game（包含该 game）
    finalGameId: -1
  }),

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
    totalScoreRightGap: 12,
    // 设置 info 表头字号及其与下方选手条目的距离，单位为 CSS 像素
    headerFontSize: 24,
    headerItemGap: 10,
    // 设置选手条目内各类文字的字号，单位为 CSS 像素
    itemFontSizes: Object.freeze({
      playerName: 24,
      totalScore: 28,
      convertedTeamScore: 16,
      stat: 22
    })
  }),

  teamTable: Object.freeze({
    // 列表占满原标题空间；10 个条目 + 9 个间距刚好铺满列表。
    itemHeightRatio: 0.0838,
    itemGapRatio: 0.018,
    // 队标高使用 CSS 像素
    teamImageHeight: 38,
    // 控制重排后是否显示排名变化图标，并始终保留其布局空间
    showRankChange: true,
    // 设置重排过程中条目放大或缩小的最大比例
    reorderScaleAmplitude: 0.012,
    itemFontSizes: Object.freeze({
      rank: 20,
      teamName: 21,
      score: 24,
      rankChange: 20
    })
  }),

  chart: Object.freeze({
    // 设置 X 轴同时显示的 game 数量
    windowSize: 6,
    // 设置滚动期间当前 game 位于从左侧起第几个 X 轴间隔
    playheadPosition: 4,
    // 控制 initialHoldDuration 阶段的小球巡线动画；false 时停留在右侧端点
    initialHoldTraversalEnabled: false,
    // 设置所有屏幕尺寸下的积分折线粗细
    lineThickness: 2.6
  }),

  labels: Object.freeze({
    // 控制折线末端的队伍名称显示
    enabled: true,
    // 设置标签字号的 CSS 像素值
    fontSize: 18,
    // 设置 Canvas 支持的标签字重
    fontWeight: 700,
    // 设置标签与折线末端圆点的水平间距
    horizontalGap: 10,
    // 右边界渐变区域的宽度，单位为 CSS 像素，必须大于 0；文字越靠右越透明
    fadeOutDistance: 120,
    // 距右边界达到此距离时文字已完全透明；必须大于 0 且小于 fadeOutDistance
    fadeOutEndDistance: 40,
    // 设置标签之间的额外垂直间距
    verticalGap: 4
  }),

  xAxis: Object.freeze({
    labels: Object.freeze({
      showInNormal: true,
      showInOverview: true,
      fontSize: 18,
      // 初始积分（game -1）处的文字，仅从全景开始显示到本轮结束
      initialText: "9/14",
      // 从全景开始到本轮结束，最后一场 game 处显示的文字
      finalText: "9/30"
    }),
    // 全景阶段期望显示的竖直网格线数量；间隔保持到下一轮开始
    overviewTargetGridLineCount: 12,
    gridLine: Object.freeze({
      // 设置竖直网格虚线的粗细、线段长度和间隔长度
      thickness: 1.3,
      dashLength: 3,
      dashGap: 6
    })
  }),

  yAxis: Object.freeze({
    labels: Object.freeze({
      showInNormal: true,
      showInOverview: true,
      fontSize: 18
    }),
    // 限制动态 Y 轴范围的下限
    minimumRange: 50,
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
