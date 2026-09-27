(function exposeTimeline(global) {
  "use strict";

  // 创建可被多个可视化组件订阅的公共时间轴
  function createTimeline(options) {
    const {
      gameDuration,
      maximumFrameDelta,
      gameTableExitDuration,
      overview,
      overviewDuration,
      restartDelay
    } = options.animation;
    const finalGame = options.finalGame;
    if (!Number.isFinite(gameTableExitDuration) || gameTableExitDuration < 0) {
      throw new Error("animation.gameTableExitDuration 必须是大于或等于 0 的数字");
    }
    const subscribers = new Set();
    let animationFrame = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    let previousCycleElapsed = 0;
    let pausedAt = null;

    // 计算当前播放状态并通知所有订阅者
    function frame(now) {
      // 每轮从 game -1（初始积分）开始，用一个完整时长过渡到 game0。
      const animationDuration = (finalGame + 1) * gameDuration;
      const lastGameHoldEnd = animationDuration + gameDuration;
      const overviewStart = lastGameHoldEnd + gameTableExitDuration;
      const overviewEnd = overviewStart + overviewDuration;
      const cycleDuration = overviewEnd + restartDelay;
      const elapsed = Math.max(0, now - startTime);
      const cycleElapsed = cycleDuration > 0 ? elapsed % cycleDuration : 0;
      const playhead = Math.min(finalGame, cycleElapsed / gameDuration - 1);
      const didRestart = elapsed >= cycleDuration && cycleElapsed < previousCycleElapsed;
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
      const phase = cycleElapsed < animationDuration
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
        deltaSeconds: Math.min(maximumFrameDelta, Math.max(0, now - lastFrameTime) / 1000),
        didRestart,
        elapsed,
        isHolding: phase !== "playing" && phase !== "overview",
        overviewProgress,
        overviewStage,
        overviewStageProgress,
        phase,
        playhead,
        tableLayoutProgress,
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
        if (animationFrame || pausedAt !== null) return;
        startTime = performance.now();
        lastFrameTime = startTime;
        previousCycleElapsed = 0;
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
        // 同时移动起点和上一帧时间，避免恢复时进度跳跃或产生超大帧间隔。
        startTime += pauseDuration;
        lastFrameTime += pauseDuration;
        pausedAt = null;
        animationFrame = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        pausedAt = null;
      }
    });
  }

  // 表格的延迟切换和两帧入场准备也使用可暂停的任务队列。
  function createPlaybackTasks() {
    const tasks = new Map();
    let nextId = 1;
    let paused = false;

    function arm(id, task) {
      task.startedAt = performance.now();
      const run = () => {
        tasks.delete(id);
        task.callback();
      };
      task.handle = task.isFrame
          ? requestAnimationFrame(run)
          : window.setTimeout(run, task.remaining);
    }

    function cancel(task) {
      if (task.isFrame) cancelAnimationFrame(task.handle);
      else window.clearTimeout(task.handle);
    }

    function schedule(callback, delay, isFrame) {
      const id = nextId++;
      const task = { callback, remaining: delay, isFrame, handle: 0, startedAt: 0 };
      tasks.set(id, task);
      if (!paused) arm(id, task);
      return id;
    }

    function clear(id) {
      const task = tasks.get(id);
      if (!task) return;
      cancel(task);
      tasks.delete(id);
    }

    return Object.freeze({
      setTimeout: (callback, delay) => schedule(callback, delay, false),
      requestAnimationFrame: callback => schedule(callback, 0, true),
      clearTimeout: clear,
      cancelAnimationFrame: clear,
      pause() {
        if (paused) return;
        paused = true;
        const now = performance.now();
        tasks.forEach(task => {
          cancel(task);
          if (!task.isFrame) task.remaining = Math.max(0, task.remaining - (now - task.startedAt));
        });
      },
      resume() {
        if (!paused) return;
        paused = false;
        tasks.forEach((task, id) => arm(id, task));
      }
    });
  }

  global.ScoreTimeline = Object.freeze({ createTimeline, createPlaybackTasks });
}(globalThis));

