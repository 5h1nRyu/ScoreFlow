(function exposeTimeline(global) {
  "use strict";

  // 创建可被多个可视化组件订阅的公共时间轴
  function createTimeline(options) {
    const {
      gameDuration,
      maximumFrameDelta,
      overview,
      overviewDuration,
      restartDelay
    } = options.animation;
    const finalGame = options.finalGame;
    const subscribers = new Set();
    let animationFrame = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    let previousCycleElapsed = 0;

    // 计算当前播放状态并通知所有订阅者
    function frame(now) {
      // 每轮从 game -1（初始积分）开始，用一个完整时长过渡到 game0。
      const animationDuration = (finalGame + 1) * gameDuration;
      const lastGameHoldEnd = animationDuration + gameDuration;
      const overviewEnd = lastGameHoldEnd + overviewDuration;
      const cycleDuration = overviewEnd + restartDelay;
      const elapsed = Math.max(0, now - startTime);
      const cycleElapsed = cycleDuration > 0 ? elapsed % cycleDuration : 0;
      const playhead = Math.min(finalGame, cycleElapsed / gameDuration - 1);
      const didRestart = elapsed >= cycleDuration && cycleElapsed < previousCycleElapsed;
      // 折线图在队伍表进场阶段完成全景展开，之后保持最终视图不动。
      const overviewProgress = overview.teamTableEnterDuration > 0
          ? Math.min(1, Math.max(0,
              (cycleElapsed - lastGameHoldEnd) / overview.teamTableEnterDuration
          ))
          : Number(cycleElapsed >= lastGameHoldEnd);
      const overviewElapsed = Math.max(0, cycleElapsed - lastGameHoldEnd);
      const overviewStages = [
        ["team-table-enter", overview.teamTableEnterDuration],
        ["initial-hold", overview.initialHoldDuration],
        ["reorder", overview.reorderDuration],
        ["final-hold", overview.finalHoldDuration]
      ];
      let overviewStage = null;
      let overviewStageProgress = 0;
      let stageStart = 0;
      if (cycleElapsed >= lastGameHoldEnd) {
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
      const phase = cycleElapsed < animationDuration
          ? "playing"
          : cycleElapsed < lastGameHoldEnd
              ? "last-game-hold"
              : cycleElapsed < overviewEnd
                  ? "overview"
                  : "restart-hold";
      const state = Object.freeze({
        completedGame: Math.floor(playhead),
        deltaSeconds: Math.min(maximumFrameDelta, Math.max(0, now - lastFrameTime) / 1000),
        didRestart,
        elapsed,
        isHolding: phase !== "playing" && phase !== "overview",
        overviewProgress,
        overviewStage,
        overviewStageProgress,
        phase,
        playhead,
        // 比赛详情维持原有节奏，不随新增的 -1 → game0 时段整体后移。
        tableCompletedGame: Math.min(finalGame, Math.floor(playhead + 1))
      });

      subscribers.forEach(subscriber => subscriber(state));
      lastFrameTime = now;
      previousCycleElapsed = cycleElapsed;
      animationFrame = requestAnimationFrame(frame);
    }

    // 仅暴露订阅和播放控制能力
    return Object.freeze({
      subscribe(subscriber) {
        subscribers.add(subscriber);
        return () => subscribers.delete(subscriber);
      },
      start() {
        if (animationFrame) return;
        startTime = performance.now();
        lastFrameTime = startTime;
        previousCycleElapsed = 0;
        animationFrame = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    });
  }

  global.ScoreTimeline = Object.freeze({ createTimeline });
}(globalThis));
