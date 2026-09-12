# ScoreFlow

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
2. 起点不一定00
3. 结束后拉远看全景
4. 加粗线增加艺术风格
5. 外部导入数据
6. 模块化
