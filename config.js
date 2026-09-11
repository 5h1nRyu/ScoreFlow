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

  teams: Object.freeze([
    Object.freeze({
      // 第一支队伍曲线使用的颜色。
      color: "#cf3f27",
      // 第一支队伍的初始分数。
      initialScore: 18
    }),
    Object.freeze({
      // 第二支队伍曲线使用的颜色。
      color: "#126783",
      // 第二支队伍的初始分数。
      initialScore: -12
    }),
    Object.freeze({
      // 第三支队伍曲线使用的颜色。
      color: "#ce9215",
      // 第三支队伍的初始分数。
      initialScore: 25
    }),
    Object.freeze({
      // 第四支队伍曲线使用的颜色。
      color: "#39714e",
      // 第四支队伍的初始分数。
      initialScore: -20
    }),
    Object.freeze({
      // 第五支队伍曲线使用的颜色。
      color: "#745087",
      // 第五支队伍的初始分数。
      initialScore: 8
    }),
    Object.freeze({
      // 第六支队伍曲线使用的颜色。
      color: "#db655d",
      // 第六支队伍的初始分数。
      initialScore: -5
    }),
    Object.freeze({
      // 第七支队伍曲线使用的颜色。
      color: "#59666e",
      // 第七支队伍的初始分数。
      initialScore: 30
    }),
    Object.freeze({
      // 第八支队伍曲线使用的颜色。
      color: "#718a31",
      // 第八支队伍的初始分数。
      initialScore: -28
    }),
    Object.freeze({
      // 第九支队伍曲线使用的颜色。
      color: "#30467d",
      // 第九支队伍的初始分数。
      initialScore: 14
    }),
    Object.freeze({
      // 第十支队伍曲线使用的颜色。
      color: "#ae6220",
      // 第十支队伍的初始分数。
      initialScore: -16
    })
  ]),

  yAxis: Object.freeze({
    // 动态计算出的 Y 轴范围下限。
    minimumRange: 20,
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
