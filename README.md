# ScoreFlow

## 页面布局

页面由横、纵两个分割位置划分为四个区域，积分折线图位于左上区域，其余区域预留给后续组件。可在 `config.js` 的 `layout` 中调整：

- `verticalSplit`：纵向分割位置，取值须在 `0` 到 `1` 之间；默认 `0.7`，即左侧占页面宽度的 70%。
- `horizontalSplit`：横向分割位置，取值须在 `0` 到 `1` 之间；默认 `0.7`，即上方占页面高度的 70%。
- `divider.visible`：是否显示横、纵分隔线，默认不显示。
- `divider.thickness`：分隔线粗细，单位为 CSS 像素。
- `divider.color`：分隔线颜色。

`timeline.js` 提供页面级公共时间轴并统一驱动已注册组件，`score-chart.js` 只负责折线图本身的尺寸和绘制，`app.js` 负责数据加载与模块装配。新增依托比赛进度的组件时，可通过 `timeline.subscribe()` 订阅同一份时间状态。

## 数据文件

所有队伍属性和累计分数均从 `scores.csv` 读取。CSV 的第一列是行属性名，而不是传统的列标题：

```csv
name,team1,team2,team3
color,#cf3f27,#126783,#ce9215
match0,0,0,0
match1,10,-10,0
```

- `name`、`color` 和 `match0` 必须存在，且每行队伍数必须一致。
- `match0` 是初始累计总分，后续 `matchN` 是该场结束后的累计总分。
- 比赛行必须从 `match0` 开始连续排列；最后一场播放完并停留数秒后，图表会重新播放。
- 可在首个 `match` 之前添加 `title`、`subcolor` 等属性行。未被页面使用的属性会保留在解析结果中，但不会影响图表。
- 队伍数和比赛数均由 CSV 动态决定。

## 折线标签

每条折线的末端会显示 CSV `name` 属性中的队伍名称。标签会跟随当前分数，并在分数接近时自动上下偏移以避免重叠；当队伍的分数大小关系互换时，标签的上下顺序也会互换。

可在 `config.js` 的 `labels` 中调整：

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
