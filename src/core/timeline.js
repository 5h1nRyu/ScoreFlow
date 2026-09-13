(function exposeTimeline(global) {
  "use strict";

  // 创建可被多个可视化组件订阅的公共时间轴
  function createTimeline(options) {
    const {
      matchDuration,
      maximumFrameDelta,
      overviewDuration,
      restartDelay
    } = options.animation;
    const finalMatch = options.finalMatch;
    const subscribers = new Set();
    let animationFrame = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    let previousCycleElapsed = 0;

    // 计算当前播放状态并通知所有订阅者
    function frame(now) {
      const animationDuration = finalMatch * matchDuration;
      const lastMatchHoldEnd = animationDuration + matchDuration;
      const overviewEnd = lastMatchHoldEnd + overviewDuration;
      const cycleDuration = overviewEnd + restartDelay;
      const elapsed = Math.max(0, now - startTime);
      const cycleElapsed = cycleDuration > 0 ? elapsed % cycleDuration : 0;
      const playhead = Math.min(finalMatch, cycleElapsed / matchDuration);
      const didRestart = elapsed >= cycleDuration && cycleElapsed < previousCycleElapsed;
      const overviewProgress = overviewDuration > 0
          ? Math.min(1, Math.max(0, (cycleElapsed - lastMatchHoldEnd) / overviewDuration))
          : Number(cycleElapsed >= lastMatchHoldEnd);
      const phase = cycleElapsed < animationDuration
          ? "playing"
          : cycleElapsed < lastMatchHoldEnd
              ? "last-match-hold"
              : cycleElapsed < overviewEnd
                  ? "overview"
                  : "restart-hold";
      const state = Object.freeze({
        completedMatch: Math.floor(playhead),
        deltaSeconds: Math.min(maximumFrameDelta, Math.max(0, now - lastFrameTime) / 1000),
        didRestart,
        elapsed,
        isHolding: phase !== "playing" && phase !== "overview",
        overviewProgress,
        phase,
        playhead
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
