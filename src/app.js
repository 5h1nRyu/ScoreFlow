(function startApplication() {
  "use strict";

  const { animation, dataUrl, layout } = APP_CONFIG;

  // 将布局比例转换为 CSS 百分比
  function percentage(value, name) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`${name} 必须是大于 0 且小于 1 的数字`);
    }
    return `${value * 100}%`;
  }

  // 校验配置并把布局参数写入页面
  function applyLayout() {
    const dashboard = document.getElementById("dashboard");
    const thickness = layout.divider.thickness;
    if (!Number.isFinite(thickness) || thickness < 0) {
      throw new Error("layout.divider.thickness 必须是大于或等于 0 的数字");
    }
    if (!CSS.supports("color", layout.divider.color)) {
      throw new Error(`分隔线颜色“${layout.divider.color}”无效`);
    }

    dashboard.style.setProperty("--vertical-split", percentage(layout.verticalSplit, "layout.verticalSplit"));
    dashboard.style.setProperty("--horizontal-split", percentage(layout.horizontalSplit, "layout.horizontalSplit"));
    dashboard.style.setProperty("--divider-thickness", `${thickness}px`);
    dashboard.style.setProperty("--divider-color", layout.divider.color);
    dashboard.classList.toggle("dashboard--dividers-visible", layout.divider.visible);
  }

  // 加载数据并装配图表与公共时间轴
  async function start() {
    try {
      applyLayout();
      const response = await fetch(dataUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`读取 ${dataUrl} 失败（HTTP ${response.status}）`);

      const data = ScoreData.parseScoreCsv(await response.text());
      // 在绘图前验证所有队伍颜色
      data.teams.forEach((team, index) => {
        if (!CSS.supports("color", team.color)) {
          throw new Error(`第 ${index + 1} 支队伍的 color“${team.color}”无效`);
        }
      });

      const finalMatch = data.matches.length - 1;
      const chart = ScoreChart.createScoreChart(
          document.getElementById("scoreChart"), data.teams, finalMatch, APP_CONFIG
      );
      const timeline = ScoreTimeline.createTimeline({ animation, finalMatch });
      // 使用同一时间状态驱动图表渲染
      timeline.subscribe(chart.render);
      timeline.start();
    } catch (error) {
      // 将初始化错误同时展示给用户和开发者
      const message = error instanceof Error ? error.message : String(error);
      const errorElement = document.getElementById("dataError");
      errorElement.textContent = `无法加载积分数据：${message}`;
      errorElement.hidden = false;
      console.error(error);
    }
  }

  start();
}());
