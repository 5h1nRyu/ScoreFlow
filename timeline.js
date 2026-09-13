(function exposeTimeline(global) {
  "use strict";

  function createTimeline(options) {
    const { matchDuration, maximumFrameDelta, restartDelay } = options.animation;
    const finalMatch = options.finalMatch;
    const subscribers = new Set();
    let animationFrame = 0;
    let startTime = 0;
    let lastFrameTime = 0;
    let previousCycleElapsed = 0;

    function frame(now) {
      const animationDuration = finalMatch * matchDuration;
      const cycleDuration = animationDuration + restartDelay;
      const elapsed = Math.max(0, now - startTime);
      const cycleElapsed = cycleDuration > 0 ? elapsed % cycleDuration : 0;
      const playhead = Math.min(finalMatch, cycleElapsed / matchDuration);
      const didRestart = elapsed >= cycleDuration && cycleElapsed < previousCycleElapsed;
      const state = Object.freeze({
        completedMatch: Math.floor(playhead),
        deltaSeconds: Math.min(maximumFrameDelta, Math.max(0, now - lastFrameTime) / 1000),
        didRestart,
        elapsed,
        isHolding: cycleElapsed >= animationDuration,
        playhead
      });

      subscribers.forEach(subscriber => subscriber(state));
      lastFrameTime = now;
      previousCycleElapsed = cycleElapsed;
      animationFrame = requestAnimationFrame(frame);
    }

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
