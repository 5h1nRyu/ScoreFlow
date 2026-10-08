(function exposeTimeline(global) {
  "use strict";

  function getCycleDuration(animation, finalGame) {
    ["backgroundHoldDuration", "entranceDuration", "gameTableExitDuration", "restartDelay"]
        .forEach(name => {
          if (!Number.isFinite(animation[name]) || animation[name] < 0) {
            throw new Error(`animation.${name} 必须是有限非负数`);
          }
        });
    ["gameDuration", "maximumFrameDelta"].forEach(name => {
      if (!Number.isFinite(animation[name]) || animation[name] <= 0) {
        throw new Error(`animation.${name} 必须是有限正数`);
      }
    });
    const overviewDuration = ["teamTableEnterDuration", "initialHoldDuration", "reorderDuration", "finalHoldDuration"]
        .reduce((total, name) => {
          const duration = animation.overview?.[name];
          if (!Number.isFinite(duration) || duration < 0) throw new Error(`animation.overview.${name} 必须是有限非负数`);
          return total + duration;
        }, 0);
    if (overviewDuration !== animation.overviewDuration) throw new Error("总览阶段总时长不一致");
    if (!Number.isInteger(finalGame) || finalGame < 0) throw new Error("时间轴缺少比赛数据");
    return animation.backgroundHoldDuration + animation.entranceDuration
        + (finalGame + 2) * animation.gameDuration + animation.gameTableExitDuration
        + overviewDuration + animation.restartDelay;
  }

  // 与原 CSS cubic-bezier 相同的缓动，直接从时间计算，不创建实时动画。
  function ease(progress, x1 = 0.25, y1 = 0.1, x2 = 0.25, y2 = 1) {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    const at = (t, p1, p2) => 3 * (1 - t) ** 2 * t * p1
        + 3 * (1 - t) * t * t * p2 + t ** 3;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 24; index += 1) {
      const t = (low + high) / 2;
      if (at(t, x1, x2) < progress) low = t;
      else high = t;
    }
    return at((low + high) / 2, y1, y2);
  }

  // 时间计算与浏览器播放驱动分离；导出只调用 renderAt。
  function createTimeline(options) {
    const {
      backgroundHoldDuration,
      entranceDuration,
      gameDuration,
      maximumFrameDelta,
      gameTableExitDuration,
      overview,
      overviewDuration
    } = options.animation;
    const finalGame = options.finalGame;
    const cycleDuration = getCycleDuration(options.animation, finalGame);
    const subscribers = new Set();
    let animationFrame = 0;
    let startTime = 0;
    let lastElapsed = 0;
    let previousCycleIndex = 0;
    let pausedAt = null;

    // 计算当前播放状态并通知所有订阅者
    function renderAt(elapsed, deltaMs = 0) {
      // 开场结束后才从初始积分推进到 game0，后续各阶段整体顺延。
      const introDuration = backgroundHoldDuration + entranceDuration;
      const animationDuration = introDuration + (finalGame + 1) * gameDuration;
      const lastGameHoldEnd = animationDuration + gameDuration;
      const overviewStart = lastGameHoldEnd + gameTableExitDuration;
      const overviewEnd = overviewStart + overviewDuration;
      const cycleElapsed = cycleDuration > 0 ? elapsed % cycleDuration : 0;
      const cycleIndex = cycleDuration > 0 ? Math.floor(elapsed / cycleDuration) : 0;
      const playhead = Math.min(finalGame, Math.max(0, cycleElapsed - introDuration) / gameDuration - 1);
      const didRestart = cycleIndex !== previousCycleIndex;
      const entranceProgress = entranceDuration > 0
          ? Math.min(1, Math.max(0, (cycleElapsed - backgroundHoldDuration) / entranceDuration))
          : Number(cycleElapsed >= backgroundHoldDuration);
      // 折线图在队伍表进场阶段完成全景展开，之后保持最终视图不动。
      const overviewProgress = overview.teamTableEnterDuration > 0
          ? Math.min(1, Math.max(0,
              (cycleElapsed - overviewStart) / overview.teamTableEnterDuration
          ))
          : Number(cycleElapsed >= overviewStart);
      const overviewElapsed = Math.max(0, cycleElapsed - overviewStart);
      // 退场时从比赛表布局平滑过渡到队伍表布局，重播时直接回到 0。
      const tableLayoutProgress = gameTableExitDuration > 0
          ? Math.min(1, Math.max(0, (cycleElapsed - lastGameHoldEnd) / gameTableExitDuration))
          : Number(cycleElapsed >= lastGameHoldEnd);
      const overviewStages = [
        ["team-table-enter", overview.teamTableEnterDuration],
        ["initial-hold", overview.initialHoldDuration],
        ["reorder", overview.reorderDuration],
        ["final-hold", overview.finalHoldDuration]
      ];
      let overviewStage = null;
      let overviewStageProgress = 0;
      let stageStart = 0;
      if (cycleElapsed >= overviewStart) {
        for (const [name, duration] of overviewStages) {
          if (overviewElapsed < stageStart + duration || name === "final-hold") {
            overviewStage = name;
            overviewStageProgress = duration > 0
                ? Math.min(1, Math.max(0, (overviewElapsed - stageStart) / duration))
                : 1;
            break;
          }
          stageStart += duration;
        }
      }
      const phase = cycleElapsed < backgroundHoldDuration
          ? "background-hold"
          : cycleElapsed < introDuration
              ? "entrance"
              : cycleElapsed < animationDuration
                  ? "playing"
                  : cycleElapsed < lastGameHoldEnd
                      ? "last-game-hold"
                      : cycleElapsed < overviewStart
                          ? "game-table-exit"
                          : cycleElapsed < overviewEnd
                              ? "overview"
                              : "restart-hold";
      const state = Object.freeze({
        completedGame: Math.floor(playhead),
        deltaSeconds: Math.max(0, deltaMs) / 1000,
        didRestart,
        elapsed,
        cycleElapsed,
        gameDuration,
        introDuration,
        entranceProgress,
        isHolding: phase !== "playing" && phase !== "overview",
        overviewProgress,
        overviewElapsed,
        reorderElapsed: overviewElapsed - overview.teamTableEnterDuration - overview.initialHoldDuration,
        overviewStage,
        overviewStageProgress,
        phase,
        playhead,
        tableLayoutProgress,
        // 比赛详情维持原有节奏，不随新增的 -1 → game0 时段整体后移。
        tableCompletedGame: cycleElapsed < introDuration
            ? -1 : Math.min(finalGame, Math.floor(playhead + 1))
      });

      subscribers.forEach(subscriber => subscriber(state));
      lastElapsed = elapsed;
      previousCycleIndex = cycleIndex;
      return state;
    }

    function frame(now) {
      const elapsed = Math.max(0, now - startTime);
      renderAt(elapsed, Math.min(maximumFrameDelta * 1000, Math.max(0, elapsed - lastElapsed)));
      animationFrame = requestAnimationFrame(frame);
    }

    // 仅暴露订阅和播放控制能力
    return Object.freeze({
      durationMs: cycleDuration,
      renderAt,
      reset() {
        this.stop();
        lastElapsed = 0;
        previousCycleIndex = 0;
      },
      subscribe(subscriber) {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      start() {
        if (options.manual) throw new Error("导出时间轴不能自动播放");
        if (animationFrame || pausedAt !== null) return;
        startTime = performance.now();
        lastElapsed = 0;
        previousCycleIndex = 0;
        animationFrame = requestAnimationFrame(frame);
      },
      pause() {
        if (!animationFrame || pausedAt !== null) return;
        pausedAt = performance.now();
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      },
      resume() {
        if (pausedAt === null) return;
        const pauseDuration = performance.now() - pausedAt;
        // 移动起点，暂停期间不计入页面时间。
        startTime += pauseDuration;
        pausedAt = null;
        animationFrame = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        pausedAt = null;
      },
      destroy() {
        this.stop();
        subscribers.clear();
      }
    });
  }

  global.ScoreTimeline = Object.freeze({ createTimeline, getCycleDuration, ease });
}(globalThis));
