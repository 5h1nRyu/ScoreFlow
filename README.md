# ScoreFlow

## TODO：

- 图片处理
- 折线图的前后逻辑
- 折线图label拥挤问题
- 下方两个区域

## 页面布局

页面由横、纵两个分割位置划分为四个区域，积分折线图位于左上区域，其余区域预留给后续组件。可在 `src/config/config.js` 的 `layout` 中调整：

- `verticalSplit`：纵向分割位置，取值须在 `0` 到 `1` 之间；默认 `0.7`，即左侧占页面宽度的 70%。
- `horizontalSplit`：横向分割位置，取值须在 `0` 到 `1` 之间；默认 `0.7`，即上方占页面高度的 70%。
- `divider.visible`：是否显示横、纵分隔线，默认不显示。
- `divider.thickness`：分隔线粗细，单位为 CSS 像素。
- `divider.color`：分隔线颜色。

`src/core/timeline.js` 提供页面级公共时间轴并统一驱动已注册组件，`src/components/score-chart.js` 只负责折线图本身的尺寸和绘制，`src/app.js` 负责数据加载与模块装配。新增依托比赛进度的组件时，可通过 `timeline.subscribe()` 订阅同一份时间状态。

## 图表线条样式

可在 `src/config/config.js` 中调整折线及坐标网格线样式，数值单位均为 Canvas 使用的 CSS 像素：

- `chart.lineThickness`：所有屏幕尺寸下的积分折线粗细；折线末端圆点会随该值等比例缩放。
- `xAxis.gridLine.thickness`：与 X 轴刻度对应的竖直网格虚线粗细。
- `xAxis.gridLine.dashLength`、`dashGap`：竖直网格虚线的线段长度和间隔长度。
- `xAxis.overviewTargetGridLineCount`：全景展开阶段期望显示的竖直网格线数量；实际间隔会从 `1、2、4、8、16...` 中选择最接近目标数量的一档，并在整个展开阶段保持稳定。
- `yAxis.gridLines.zero`：零分水平线的样式。
- `yAxis.gridLines.major`：主刻度水平虚线的样式。
- `yAxis.gridLines.minor`：次刻度水平虚线的样式。

每一项 Y 轴线条样式均可分别设置 `thickness`、`dashLength` 和 `dashGap`。`dashLength` 与 `dashGap` 通常须同时为大于 `0` 的数字；零分线可将二者同时设为 `0` 以显示为实线。

## 文件结构

```text
ScoreFlow/
├── assets/
│   ├── css/
│   │   └── styles.css              # 页面布局和组件样式
│   └── images/game-table/
│       ├── players/                # 以选手 name 命名的 PNG 头像
│       └── teams/                  # 以 team 命名的 PNG 队标
├── data/
│   ├── games.json                  # 按顺序存储的单个 game 选手详情与得分
│   └── teams.json                  # 队伍属性、初始积分和队员名单
├── src/
│   ├── components/
│   │   ├── game-table.js           # 比赛详情表及逐项切换动画
│   │   ├── team-table.js           # 队伍总分排名及重排动画
│   │   └── score-chart.js          # 折线图计算与 Canvas 绘制
│   ├── config/
│   │   └── config.js               # 页面、动画和图表配置
│   ├── core/
│   │   └── timeline.js             # 公共动画时间轴
│   ├── data/
│   │   ├── game-data.js            # game JSON 校验与转换
│   │   └── team-data.js            # 队伍 JSON 校验、归属关联和积分累计
│   └── app.js                      # 应用入口与模块装配
├── index.html                      # 页面结构和资源入口
└── README.md                       # 使用与架构说明
```

文件按职责分为静态资源、业务数据和源代码三类。`src` 内再按配置、数据处理、核心能力和可视化组件拆分，新增功能时应放入职责最接近的目录。

## 项目逻辑架构

项目采用无构建工具的浏览器端分层结构，各脚本按依赖顺序由 `index.html` 加载：

1. **配置层**：`src/config/config.js` 创建只读的 `APP_CONFIG`，集中提供布局比例、动画速度、数据地址和图表参数
2. **数据层**：`src/data/team-data.js` 和 `src/data/game-data.js` 校验两份 JSON，根据队员名关联队伍，并按 game 累加队伍积分
3. **时间轴层**：`src/core/timeline.js` 根据配置按 game 计算播放头、帧间隔和循环状态，通过订阅机制向组件广播统一状态
4. **组件层**：`src/components/score-chart.js` 负责 Canvas 尺寸适配、坐标映射、曲线插值、标签避让和逐帧绘制
5. **装配层**：`src/app.js` 应用布局配置，加载两份 JSON，创建时间轴和图表并连接订阅关系，同时集中处理初始化错误

核心数据流如下：

```text
APP_CONFIG ──> 应用入口 ──> 页面布局
                    │
teams.json ──┐
             ├──> 数据校验与关联 ──> 队伍时间序列 ──> 积分图表
games.json ──┘             │                          ↑
                           └──> 公共时间轴 ───────────┘
```

模块通过 `globalThis` 暴露只读入口，避免跨层访问内部状态。时间轴只发布状态而不负责绘图，因此后续组件可以订阅同一时间轴，与积分图表保持同步。

## 比赛详情表

右上区域的 `game-table` 从 `data/games.json` 读取按 `gameId` 连续排列的 game 数据，并使用每个 game 的 `info` 字符串作为表头。详情表与折线图订阅同一条公共时间轴：积分图每个 game 更新一次，详情表则将相邻的两个 game 组成一组，每两个 game 更新一次。切换时，旧的八个条目按照两个 game 各自从上到下的顺序向左滑出，新条目随后从右滑入。时间轴进入 `overview` 后会隐藏比赛详情并启用预留的 `team-table` 容器，循环重启时恢复前两个 game。

每轮新增的 `game -1` 到 `game0` 折线动画不会延后比赛详情：`game-table` 的内容及换组动画相对公共播放头前移一个 `gameDuration`。该偏移不影响总览切换，最后一组比赛仍会额外展示一个 `gameDuration`，直到时间轴真正进入 `overview` 后才切换到 `team-table`。

可在 `src/config/config.js` 的 `gameTable.itemFontSizes` 中调整选手条目内的字号，数值单位均为 CSS 像素：

- `playerName`：选手名字号。
- `totalScore`：总分字号。
- `convertedTeamScore`：换算队伍得分字号。

`gameTable` 还提供以下条目布局配置：

- `headerFontSize`：每场比赛 `info` 表头的字号，单位为 CSS 像素。
- `headerItemGap`：`info` 表头与下方首个选手条目的距离，单位为 CSS 像素。
- `itemHeightRatio`：单个选手条目高度与整个 `game-table` 区域高度的比例。
- `itemGapRatio`：同一场比赛中相邻选手条目间距与整个 `game-table` 区域高度的比例。
- `playerImageHeightRatio`：头像高度与条目高度的比例；大于 `1` 时头像会从条目顶部伸出，且不会被条目裁切。
- `totalScoreRightGap`：总分区域与条目右端的距离，单位为 CSS 像素。

头像保持原始比例，并以头像左下角和条目左下角为锚点。背景队标同样保持原始比例，以右上角为锚点缩放至铺满整个条目，超出条目的部分不会显示。

比赛条目仅展示选手信息与得分，得分靠右排列。选手所属队伍根据 `teams.json` 中的队员名单动态取得，不在每场比赛中重复保存。

人物头像和队标不存储在 JSON 中，按以下固定约定添加 PNG 文件：

- 人物头像：`assets/images/game-table/players/<name>.png`
- 队标：`assets/images/game-table/teams/<team>.png`

例如 `name` 为 `player04`、`team` 为 `team04` 时，对应文件分别为 `players/player04.png` 和 `teams/team04.png`。资源尚未添加或加载失败时，组件会保留排版空间并隐藏破损图片。

## 数据文件

队伍基础信息从 `data/teams.json` 读取。文件固定包含 10 支队伍，每支队伍包含唯一的队伍名、折线标签简称、折线颜色、初始分数和 4 名队员：

```json
{
  "teams": [
    {
      "name": "team01",
      "shortName": "T01",
      "color": "#cf3f27",
      "initialScore": 0,
      "players": ["player01", "player02", "player03", "player04"]
    }
  ]
}
```

`data/games.json` 中每名选手只保存 `name`、`score` 和 `teamPoint`。`gameId` 必须从 0 开始连续排列，每个 game 必须恰好有 4 名来自不同队伍的选手，且全部 40 名选手都必须至少出场一次。

调试时可将 `debug.finalGameId` 设为大于 `0` 且小于 game 总场数的整数 `x`，页面将只演示 `game0` 到 `gamex`（包含 `gamex`），并据此计算最终积分和排名。默认值 `-1` 表示使用完整数据。

积分时间序列从各队的 `initialScore` 开始计算。每场比赛结束时，程序根据选手名找到 `teams.json` 中的所属队伍，将该选手的 `teamPoint` 累加到队伍当前分数；没有选手出场的队伍保持原分数。同一场中每支队伍至多有一名选手。图表使用 `x = -1` 完整显示纯初始分数，并在每轮开始后的第一个 `gameDuration` 内过渡到 `x = 0` 的“初始分数 + game0 的 teamPoint”。最后一个 game 播放完并停留数秒后，图表会重新播放。

## 循环结束动画

正常播放时，每轮先用一个 `gameDuration` 让折线从 `game -1` 的初始积分进入 `game0`。折线末端到达 `chart.playheadPosition` 指定的位置后，X 轴开始滚动。最后一个 game 能够落在绘图区右边界时，X 轴停止滚动，折线末端继续向右移动并最终到达右边界。折线到达最后一个 game 后，会先原地停留一个 `gameDuration`；随后 X 轴平滑展开，直至 `game -1` 和最后一个 game 分别位于绘图区左右边界，以展示完整折线。展开开始时会隐藏折线末端的队伍名称，展开完成后继续按 `restartDelay` 停留，再开始下一轮播放。

可在 `src/config/config.js` 的 `chart` 中调整：

- `windowSize`：X 轴窗口同时显示的 game 数量。
- `playheadPosition`：滚动期间当前 game 位于从左侧起第几个 X 轴间隔；必须是大于 `0` 且小于 `windowSize` 的整数。
- `lineThickness`：积分折线的粗细。

可在 `src/config/config.js` 的 `animation` 中调整：

- `gameDuration`：每个 game 的动画时长，也用于每轮的 `game -1` 到 `game0` 动画，以及到达最后一个 game 后的额外停留。
- `overview.teamTableEnterDuration`：队伍排名表按初始分数进场的动画时长；折线图也会在此阶段完成全景展开。
- `overview.initialHoldDuration`：初始排名进场后的停留时长。
- `overview.reorderDuration`：积分数字变化及最终排名重排的动画时长。
- `overview.finalHoldDuration`：最终排名重排完成后的停留时长。
- `overviewDuration`：以上四项之和，由配置自动计算并作为完整队伍表总览阶段的时长。
- `restartDelay`：全景展开完成后、下一轮播放开始前的停留时长。

## 队伍总分排名

进入全景阶段后，右上区域依次展示 10 支队伍的初始排名和最终排名。初始排名直接使用
`teams.json` 的 `initialScore`，不包含 `game0`；重排时分数平滑变化至最后一场结束后的累计分数，
条目同步上下交换。分数相同的队伍采用竞赛排名（例如 `1、2、2、4`），同分时保持数据文件中的
原始先后顺序。每组并列队伍只有第一支显示数字排名，后续队伍以 `-` 表示并列。

重排期间，最终排名较高的条目具有更高的层叠顺序，并通过轻微缩放增强交错效果。排名变化以
绿色 `▲`、红色 `▼` 或灰色 `=` 显示，并附带上升或下降的名次数。队标文件约定为
`assets/images/icons/<team>.png`；缺少图片时会隐藏破损图像但保留布局。

排行榜在重排前使用 `teamTable.initialTitle`，重排开始后使用 `teamTable.finalTitle`，两个标题均左对齐并以淡出、淡入动画切换。可通过 `teamTable.titleFontSize` 设置标题字号，通过 `teamTable.titleTransitionDuration` 设置单次淡出或淡入的毫秒数。另可在 `teamTable` 配置中调整 `itemHeightRatio`、`itemGapRatio`、`teamImageHeight`、`reorderScaleAmplitude`（重排时条目的最大缩放比例），以及
`itemFontSizes.rank`、`itemFontSizes.teamName`、`itemFontSizes.score`、
`itemFontSizes.rankChange`。`teamImageHeight` 是队标高度的 CSS 像素值，可以大于条目高度；超出条目的部分会被裁切。队标、排名、队伍名称、分数和排名变化文字均与条目的竖直中心对齐。

`teamTable.showRankChange` 用于控制重排后是否显示排名变化图标，默认为 `true`。设为 `false` 时图标不可见，但仍保留原有布局空间。

## 折线标签

每条折线的末端会显示 `teams.json` 中的 `shortName` 队伍简称。标签会跟随当前分数，并在分数接近时自动上下偏移以避免重叠；当队伍的分数大小关系互换时，标签的上下顺序也会互换。当最长的队伍简称连同预留空间无法完整放入折线末端与绘图区右边界之间时，所有队伍标签会同步渐隐。

可在 `src/config/config.js` 的 `labels` 中调整：

- `enabled`：标签显示开关。
- `fontSize`：标签字号。
- `fontWeight`：标签加粗程度。
- `horizontalGap`：标签与折线末端的水平间距。
- `rightSafetyMargin`：检测右侧空间时，在最长标签末端额外保留的像素数。
- `fadeOutDuration`：右侧空间不足后所有标签同步渐隐的毫秒数；设为 `0` 时立即隐藏。
- `verticalGap`：避让时标签之间的额外垂直间距。

由于浏览器需要通过 HTTP 加载 JSON，请不要直接以 `file://` 打开页面。例如可在项目目录运行：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。
