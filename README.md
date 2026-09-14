# ScoreFlow

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
│   ├── games.json                  # 按顺序存储的单个 game 选手详情
│   └── scores.csv                  # 队伍属性和累计积分
├── src/
│   ├── components/
│   │   ├── game-table.js           # 比赛详情表及逐项切换动画
│   │   └── score-chart.js          # 折线图计算与 Canvas 绘制
│   ├── config/
│   │   └── config.js               # 页面、动画和图表配置
│   ├── core/
│   │   └── timeline.js             # 公共动画时间轴
│   ├── data/
│   │   ├── game-data.js            # game JSON 校验与转换
│   │   └── score-data.js           # CSV 解析和业务数据转换
│   └── app.js                      # 应用入口与模块装配
├── index.html                      # 页面结构和资源入口
└── README.md                       # 使用与架构说明
```

文件按职责分为静态资源、业务数据和源代码三类。`src` 内再按配置、数据处理、核心能力和可视化组件拆分，新增功能时应放入职责最接近的目录。

## 项目逻辑架构

项目采用无构建工具的浏览器端分层结构，各脚本按依赖顺序由 `index.html` 加载：

1. **配置层**：`src/config/config.js` 创建只读的 `APP_CONFIG`，集中提供布局比例、动画速度、数据地址和图表参数
2. **数据层**：`src/data/score-data.js` 读取入口传入的 CSV 文本，处理引号转义、校验属性与 game 行，并生成队伍时间序列
3. **时间轴层**：`src/core/timeline.js` 根据配置按 game 计算播放头、帧间隔和循环状态，通过订阅机制向组件广播统一状态
4. **组件层**：`src/components/score-chart.js` 负责 Canvas 尺寸适配、坐标映射、曲线插值、标签避让和逐帧绘制
5. **装配层**：`src/app.js` 应用布局配置，加载 `data/scores.csv`，创建时间轴和图表并连接订阅关系，同时集中处理初始化错误

核心数据流如下：

```text
APP_CONFIG ──> 应用入口 ──> 页面布局
                    │
scores.csv ──> CSV 解析器 ──> 队伍时间序列 ──> 积分图表
                    │                         ↑
                    └──> 公共时间轴 ──────────┘
```

模块通过 `globalThis` 暴露只读入口，避免跨层访问内部状态。时间轴只发布状态而不负责绘图，因此后续组件可以订阅同一时间轴，与积分图表保持同步。

## 比赛详情表

右上区域的 `game-table` 从 `data/games.json` 读取按 `gameId` 连续排列的 game 数据，并使用每个 game 的 `info` 字符串作为表头。详情表与折线图订阅同一条公共时间轴：积分图每个 game 更新一次，详情表则将相邻的两个 game 组成一组，每两个 game 更新一次。切换时，旧的八个条目按照两个 game 各自从上到下的顺序向左滑出，新条目随后从右滑入。时间轴进入 `overview` 后会隐藏比赛详情并启用预留的 `team-table` 容器，循环重启时恢复前两个 game。

可在 `src/config/config.js` 的 `gameTable.itemFontSizes` 中调整选手条目内的字号，数值单位均为 CSS 像素：

- `playerName`：选手名字号。
- `totalScore`：总分字号。
- `convertedTeamScore`：换算队伍得分字号。
- `stat`：立直、和了和放铳次数共用的字号。

人物头像和队标不存储在 JSON 中，按以下固定约定添加 PNG 文件：

- 人物头像：`assets/images/game-table/players/<name>.png`
- 队标：`assets/images/game-table/teams/<team>.png`

例如 `name` 为 `player04`、`team` 为 `team04` 时，对应文件分别为 `players/player04.png` 和 `teams/team04.png`。资源尚未添加或加载失败时，组件会保留排版空间并隐藏破损图片。

## 数据文件

所有队伍属性和累计分数均从 `data/scores.csv` 读取。CSV 的第一列是行属性名，而不是传统的列标题：

```csv
name,team1,team2,team3
color,#cf3f27,#126783,#ce9215
game0,0,0,0
game1,10,-10,0
```

- `name`、`color` 和 `game0` 必须存在，且每行队伍数必须一致。
- `game0` 表示第一场真实 game 结束后的累计总分，后续 `gameN` 依次表示对应 game 结束后的累计总分。
- game 行必须从 `game0` 开始连续排列；最后一个 game 播放完并停留数秒后，图表会重新播放。
- 可在首个 `game` 之前添加 `title`、`subcolor` 等属性行。未被页面使用的属性会保留在解析结果中，但不会影响图表。
- 队伍数和 game 数均由 CSV 动态决定；`data/games.json` 的 game 数量必须与 CSV 一致且为偶数。

## 循环结束动画

折线到达最后一个 game 后，会先原地停留一个 `gameDuration`；随后 X 轴平滑展开，直至 `game0` 和最后一个 game 分别位于绘图区左右边界，以展示完整折线。展开开始时会隐藏折线末端的队伍名称，展开完成后继续按 `restartDelay` 停留，再开始下一轮播放。

可在 `src/config/config.js` 的 `animation` 中调整：

- `gameDuration`：每个 game 的动画时长，也是到达最后一个 game 后的额外停留时长。
- `overviewDuration`：X 轴展开至完整比赛范围的动画时长。
- `restartDelay`：全景展开完成后、下一轮播放开始前的停留时长。

## 折线标签

每条折线的末端会显示 CSV `name` 属性中的队伍名称。标签会跟随当前分数，并在分数接近时自动上下偏移以避免重叠；当队伍的分数大小关系互换时，标签的上下顺序也会互换。

可在 `src/config/config.js` 的 `labels` 中调整：

- `enabled`：标签显示开关。
- `fontSize`：标签字号。
- `fontWeight`：标签加粗程度。
- `horizontalGap`：标签与折线末端的水平间距。
- `verticalGap`：避让时标签之间的额外垂直间距。

由于浏览器需要通过 HTTP 加载 CSV，请不要直接以 `file://` 打开页面。例如可在项目目录运行：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。

### todo:
1. y轴水平线样式改动
2. 结束后拉远看全景
3. 加粗线增加艺术风格
