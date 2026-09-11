// 获取画布和绘图上下文
const canvas = document.getElementById("scoreChart");
const ctx = canvas.getContext("2d");

// 每场比赛对应的动画时长
const MATCH_DURATION = 1150;

// X 轴可见比赛数量
const WINDOW_SIZE = 12;

// 播放点保持在窗口中心附近
const CENTER_MATCH = WINDOW_SIZE / 2;

// Y 轴初始显示范围
const INITIAL_DISPLAYED_RANGE = 60;

// 各队伍曲线颜色
const COLORS = [
  "#cf3f27", "#126783", "#ce9215", "#39714e", "#745087",
  "#db655d", "#59666e", "#718a31", "#30467d", "#ae6220"
];

// 初始化队伍数据
const teams = COLORS.map((color, index) => ({
  color,
  index,
  values: [0]
}));

// 动画起始时间
let startTime = performance.now();

// 上一帧时间
let lastFrame = startTime;

// 当前 Y 轴显示范围
let displayedRange = INITIAL_DISPLAYED_RANGE;

// 记录 Y 轴是否曾经扩张
let hasExpandedYAxis = false;


/**
 * 生成某支队伍下一场比赛后的分数
 */
function scoreForMatch(team, match, previous) {
  // 不同队伍设置不同基础方向
  const direction = team % 2 === 0 ? 1 : -1;

  // 随比赛进程变化的波动幅度
  const volatility =
      10 + 34 * (0.5 + 0.5 * Math.sin(match * 0.14 - 1.2));

  // 主要分数波动
  const swing =
      Math.sin(match * 0.82 + team * 1.73) * volatility;

  // 高频波动
  const shock =
      Math.sin(match * 2.37 + team * 4.11) *
      volatility *
      0.45;

  // 将过大的分数轻微拉回零点
  const pullToZero = -previous * 0.13;

  return Math.round(
      previous +
      direction * 5 +
      swing +
      shock +
      pullToZero
  );
}


/**
 * 确保所有队伍已有足够的数据
 */
function ensureData(lastMatch) {
  teams.forEach((team) => {
    while (team.values.length <= lastMatch + 1) {
      const match = team.values.length;

      team.values.push(
          scoreForMatch(
              team.index,
              match,
              team.values.at(-1)
          )
      );
    }
  });
}


/**
 * 根据窗口大小调整 Canvas 分辨率
 */
function resizeCanvas() {
  // 限制最高设备像素比
  const dpr = Math.min(
      window.devicePixelRatio || 1,
      2
  );

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  // 后续继续使用 CSS 像素坐标
  ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
  );
}


/**
 * 计算三次 Bezier 的一维坐标
 */
function cubicBezierValue(p0, p1, p2, p3, t) {
  const oneMinusT = 1 - t;

  return (
      oneMinusT ** 3 * p0 +
      3 * oneMinusT ** 2 * t * p1 +
      3 * oneMinusT * t ** 2 * p2 +
      t ** 3 * p3
  );
}


/**
 * 根据 X 轴进度反求 Bezier 参数
 */
function parameterForXProgress(progress) {
  // 两个 X 控制点都位于区间中点
  const xAtParameter = t =>
      cubicBezierValue(
          0,
          0.5,
          0.5,
          1,
          t
      );

  // 处理区间边界
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  let low = 0;
  let high = 1;

  // 二分查找对应参数
  for (let i = 0; i < 16; i += 1) {
    const middle = (low + high) / 2;
    const x = xAtParameter(middle);

    if (x < progress) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return (low + high) / 2;
}


/**
 * 获取固定 Bezier 曲线在指定时间位置上的分数
 */
function valueOnFixedCurve(team, time) {
  const match = Math.floor(time);
  const progress = time - match;

  const from = team.values[match];
  const to = team.values[match + 1];

  // 整数点直接返回原始数据
  if (progress <= 0) {
    return from;
  }

  if (progress >= 1) {
    return to;
  }

  // 根据当前 X 位置求 Bezier 参数
  const t = parameterForXProgress(progress);

  // Y 控制点与两个端点保持水平
  return cubicBezierValue(
      from,
      from,
      to,
      to,
      t
  );
}


/**
 * 使用固定整数数据点生成 Bezier 曲线
 */
function appendSmoothCurve(points) {
  if (points.length === 0) {
    return;
  }

  ctx.moveTo(
      points[0].x,
      points[0].y
  );

  for (
      let index = 1;
      index < points.length;
      index += 1
  ) {
    const previous = points[index - 1];
    const current = points[index];

    // 控制点始终由两个固定整数点决定
    const controlX =
        (previous.x + current.x) / 2;

    ctx.bezierCurveTo(
        controlX,
        previous.y,
        controlX,
        current.y,
        current.x,
        current.y
    );
  }
}


/**
 * 计算适合显示的刻度间隔
 */
function niceStep(rawStep) {
  // 获取数量级
  const magnitude =
      10 ** Math.floor(
          Math.log10(
              Math.max(rawStep, 1)
          )
      );

  const fraction =
      rawStep / magnitude;

  // 刻度限制为 1 2 5 10
  const niceFraction =
      fraction <= 1
          ? 1
          : fraction <= 2
              ? 2
              : fraction <= 5
                  ? 5
                  : 10;

  return niceFraction * magnitude;
}


/**
 * 根据最大分数计算 Y 轴范围
 */
function rangeForPeak(peak) {
  // 保留约 12% 的上下边距
  return Math.max(
      20,
      peak * 1.12
  );
}


/**
 * 绘制当前动画帧
 */
function draw(now) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 根据窗口尺寸动态设置边距
  const margin = {
    left: Math.max(
        48,
        Math.min(78, width * 0.065)
    ),
    right: Math.max(
        18,
        width * 0.025
    ),
    top: Math.max(
        18,
        height * 0.035
    ),
    bottom: Math.max(
        42,
        height * 0.075
    )
  };

  const plotWidth =
      width -
      margin.left -
      margin.right;

  const plotHeight =
      height -
      margin.top -
      margin.bottom;

  // 当前播放到的比赛位置
  const playhead = Math.max(
      0,
      (now - startTime) /
      MATCH_DURATION
  );

  // 当前所在的整数区间
  const completedMatch =
      Math.floor(playhead);

  // 提前生成下一个完整整数点
  ensureData(
      completedMatch + 1
  );


  // 播放点到达中心后开始滚动画面
  const viewStart = Math.max(
      0,
      playhead - CENTER_MATCH
  );

  const viewEnd =
      viewStart + WINDOW_SIZE;

  // 将比赛编号映射到 X 坐标
  const xAt = match =>
      margin.left +
      (
          (match - viewStart) /
          WINDOW_SIZE
      ) *
      plotWidth;


  // 收集当前窗口中的可见分数
  const visibleValues =
      teams.flatMap((team) => {
        const first =
            Math.ceil(viewStart);

        const values =
            team.values.slice(
                first,
                completedMatch + 1
            );

        // 加入窗口左边界上的曲线值
        values.push(
            valueOnFixedCurve(
                team,
                viewStart
            )
        );

        // 加入当前曲线末端值
        values.push(
            valueOnFixedCurve(
                team,
                playhead
            )
        );

        return values;
      });


  // 找到当前最大绝对分数
  const peak = Math.max(
      8,
      ...visibleValues.map(
          Math.abs
      )
  );

  // 计算目标 Y 轴范围
  const targetRange =
      rangeForPeak(peak);

  // 计算当前帧时间间隔
  const frameSeconds =
      Math.min(
          0.05,
          (now - lastFrame) /
          1000
      );

  const isExpanding =
      targetRange >
      displayedRange;


  // 超过初始范围后开启动态缩放
  if (
      targetRange >
      INITIAL_DISPLAYED_RANGE
  ) {
    hasExpandedYAxis = true;
  }


  // 平滑调整 Y 轴范围
  if (
      isExpanding ||
      hasExpandedYAxis
  ) {
    const scaleRate =
        isExpanding ? 6 : 1.8;

    displayedRange +=
        (
            targetRange -
            displayedRange
        ) *
        (
            1 -
            Math.exp(
                -scaleRate *
                frameSeconds
            )
        );
  }

  lastFrame = now;


  // 将分数映射到 Y 坐标
  const yAt = score =>
      margin.top +
      plotHeight / 2 -
      (
          score /
          displayedRange
      ) *
      (
          plotHeight / 2
      );


  // 清空上一帧
  ctx.clearRect(
      0,
      0,
      width,
      height
  );


  // 设置坐标文字样式
  ctx.font =
      `600 ${
          width < 520 ? 11 : 14
      }px "Courier New", monospace`;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.textBaseline =
      "middle";

  ctx.textAlign =
      "right";


  // 计算 Y 轴主刻度
  const contourStep =
      niceStep(
          (displayedRange * 2) /
          8
      );

  // 次刻度为主刻度的一半
  const minorStep =
      contourStep / 2;

  // 找到第一个可见刻度
  const firstContour =
      Math.ceil(
          -displayedRange /
          minorStep
      ) *
      minorStep;


  // 绘制水平网格线
  for (
      let score =
          firstContour;
      score <=
      displayedRange;
      score += minorStep
  ) {
    // 判断是否为零线
    const isZero =
        Math.abs(score) <
        minorStep / 10;

    // 判断是否为主刻度
    const isMajor =
        Math.abs(
            score /
            contourStep -
            Math.round(
                score /
                contourStep
            )
        ) < 0.01;

    const y = yAt(score);


    // 设置网格线样式
    ctx.strokeStyle =
        isZero
            ? "rgba(28,30,25,.86)"
            : isMajor
                ? "rgba(28,30,25,.3)"
                : "rgba(28,30,25,.16)";

    ctx.lineWidth =
        isZero
            ? 2.4
            : isMajor
                ? 1.6
                : 1.1;

    ctx.setLineDash(
        isZero
            ? []
            : isMajor
                ? [4, 5]
                : [2, 6]
    );


    // 绘制水平线
    ctx.beginPath();

    ctx.moveTo(
        margin.left,
        y
    );

    ctx.lineTo(
        width -
        margin.right,
        y
    );

    ctx.stroke();


    // 主刻度显示数值
    if (isMajor) {
      ctx.setLineDash([]);

      ctx.beginPath();

      ctx.moveTo(
          margin.left - 7,
          y
      );

      ctx.lineTo(
          margin.left,
          y
      );

      ctx.stroke();

      ctx.fillStyle =
          "rgba(28,30,25,.82)";

      ctx.fillText(
          Math.round(score),
          margin.left - 12,
          y
      );
    }
  }


  // 设置 X 轴文字样式
  ctx.textAlign = "center";
  ctx.textBaseline = "top";


  // 绘制垂直网格线
  for (
      let match =
          Math.ceil(viewStart);
      match <=
      Math.floor(viewEnd);
      match += 1
  ) {
    const x = xAt(match);

    ctx.strokeStyle =
        "rgba(28,30,25,.16)";

    ctx.lineWidth = 1.3;

    ctx.setLineDash(
        [3, 6]
    );

    ctx.beginPath();

    ctx.moveTo(
        x,
        margin.top
    );

    ctx.lineTo(
        x,
        height -
        margin.bottom
    );

    ctx.stroke();


    // 绘制比赛编号
    ctx.fillStyle =
        "rgba(28,30,25,.78)";

    ctx.fillText(
        String(match),
        x,
        height -
        margin.bottom +
        14
    );
  }


  // 绘制图表外框
  ctx.setLineDash([]);

  ctx.strokeStyle =
      "rgba(28,30,25,.82)";

  ctx.lineWidth = 1.8;

  ctx.strokeRect(
      margin.left,
      margin.top,
      plotWidth,
      plotHeight
  );


  // 当前曲线显示到的 X 坐标
  const revealX = Math.min(
      width - margin.right,
      Math.max(
          margin.left,
          xAt(playhead)
      )
  );


  // 绘制每支队伍的分数曲线
  teams.forEach((team) => {
    const points = [];

    // 多取一个左侧点保证边缘曲线连续
    const firstMatch =
        Math.max(
            0,
            Math.floor(
                viewStart
            ) - 1
        );

    // 必须加入当前区间完整的终点 B
    const lastMatch =
        completedMatch + 1;


    // 所有点均为固定整数数据点
    for (
        let match =
            firstMatch;
        match <= lastMatch;
        match += 1
    ) {
      points.push({
        x: xAt(match),
        y: yAt(
            team.values[
                match
                ]
        )
      });
    }


    ctx.save();


    // 只显示播放头之前的区域
    ctx.beginPath();

    ctx.rect(
        margin.left,
        margin.top,
        Math.max(
            0,
            revealX -
            margin.left
        ),
        plotHeight
    );

    ctx.clip();


    // 使用固定整数点生成完整曲线
    ctx.beginPath();

    appendSmoothCurve(
        points
    );

    ctx.globalAlpha =
        0.92;

    ctx.strokeStyle =
        team.color;

    ctx.lineWidth =
        width < 520
            ? 2.8
            : 3.6;

    ctx.stroke();

    ctx.restore();


    // 计算播放头在固定曲线上的真实位置
    const tipValue =
        valueOnFixedCurve(
            team,
            playhead
        );

    const tipX =
        xAt(playhead);

    const tipY =
        yAt(tipValue);


    // 绘制曲线末端圆点
    if (
        tipX >= margin.left &&
        tipX <=
        width -
        margin.right
    ) {
      ctx.fillStyle =
          team.color;

      ctx.beginPath();

      ctx.arc(
          tipX,
          tipY,
          width < 520
              ? 3.2
              : 4.2,
          0,
          Math.PI * 2
      );

      ctx.fill();
    }
  });


  // 请求下一帧动画
  requestAnimationFrame(draw);
}


// 窗口尺寸变化时重新设置画布
window.addEventListener(
    "resize",
    resizeCanvas
);

// 初始化画布
resizeCanvas();

// 启动动画
requestAnimationFrame(draw);