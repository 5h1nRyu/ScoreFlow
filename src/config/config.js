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
  backgroundColor: "#ffffff",

  layout: Object.freeze({
    // 页面外围留白分别相对于视口宽度和高度计算
    pageMargin: Object.freeze({ horizontal: 0.025, top: 0.025, bottom: 0.05 }),
    // 页面主体按标题和图表区从上到下紧凑排列
    rows: Object.freeze({ title: 0.125, chart: 0.8 }),
    // 两个表格分别占整页的比例；折线图自动使用扣除左右边距和当前表格后的空间
    // 列间距包含在折线图区内，不额外占用页面宽度
    chartColumns: Object.freeze({ gameTable: 0.25, teamTable: 0.3 })
  }),

  title: Object.freeze({
    text: "9月积分演变",
    fontSize: 60,
    // 图标槽位暂不放置实际资源；三列宽度之和必须为 1
    columns: Object.freeze({ icon1: 0.3, text: 0.5, icon2: 0.2 })
  }),

  animation: Object.freeze({
    // 设置每个 game 对应的动画毫秒数
    gameDuration: 2000,
    // 限制单帧参与缩放计算的最大秒数
    maximumFrameDelta: 0.05,
    // 比赛表退场与布局宽度变化同步完成，结束后才开始队伍表进场；0 表示立即切换
    gameTableExitDuration: 240,
    // 四段时长之和作为完整的队伍表总览阶段时间
    overview: OVERVIEW_PHASES,
    overviewDuration: OVERVIEW_DURATION,
    // 设置最后一场结束后重新播放前的停留毫秒数
    restartDelay: 3000
  }),

  // 指定队伍、队员归属和初始分数的数据文件
  teamsDataUrl: "data/teams.json",
  // 指定每个 game 的选手数据文件
  gamesDataUrl: "data/games.json",

  debug: Object.freeze({
    // 显示布局区域与表格内容列的调试边框，不影响实际布局尺寸
    showLayoutBorders: false,
    // -1 使用完整数据；正整数 x 只演示到 gameId 为 x 的 game（包含该 game）
    finalGameId: 9
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
    headerFontSize: 36,
    headerItemGap: 10,
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

  teamTable: Object.freeze({
    // 分别设置重排前后的排行榜标题
    initialTitle: "9月13日队伍排名",
    finalTitle: "9月30日队伍排名",
    // 设置标题字号与单次淡出或淡入动画时长
    titleFontSize: 20,
    titleTransitionDuration: 180,
    // 条目高度和间距均相对于 team-table 区域高度计算
    itemHeightRatio: 0.075,
    itemGapRatio: 0.018,
    // 队标高使用 CSS 像素
    teamImageHeight: 80,
    // 控制重排后是否显示排名变化图标，并始终保留其布局空间
    showRankChange: false,
    // 设置重排过程中条目放大或缩小的最大比例
    reorderScaleAmplitude: 0.012,
    itemFontSizes: Object.freeze({
      rank: 28,
      teamName: 24,
      score: 30,
      rankChange: 20
    }),
    teamImageBaseUrl: "assets/images/icons"
  }),

  chart: Object.freeze({
    // 设置 X 轴同时显示的 game 数量
    windowSize: 6,
    // 设置滚动期间当前 game 位于从左侧起第几个 X 轴间隔
    playheadPosition: 4,
    // 控制 initialHoldDuration 阶段的小球巡线动画；false 时停留在右侧端点
    initialHoldTraversalEnabled: false,
    // 设置所有屏幕尺寸下的积分折线粗细
    lineThickness: 6
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
    // 在最长标签宽度之外额外保留的 CSS 像素
    rightSafetyMargin: 50,
    // 设置右侧空间不足后标签渐隐的毫秒数；设为 0 时立即隐藏
    fadeOutDuration: 100,
    // 设置标签之间的额外垂直间距
    verticalGap: 4
  }),

  xAxis: Object.freeze({
    labels: Object.freeze({
      showInNormal: true,
      showInOverview: true,
      fontSize: 24
    }),
    // 全景阶段期望显示的竖直网格线数量
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
      fontSize: 24
    }),
    // 限制动态 Y 轴范围的下限
    minimumRange: 60,
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

