(function exposeVideoExport(global) {
  "use strict";

  const application = global.ScoreApplication;
  let prepared = false;
  let preparing = false;
  let disposed = false;
  let nextFrameIndex = 0;

  function assertOpen() {
    if (disposed) throw new Error("逐帧接口已释放，请重新打开页面");
  }

  function assertPrepared() {
    assertOpen();
    if (!prepared || preparing) throw new Error("请先等待 prepare(options) 完成");
  }

  function validateOptions(options) {
    if (!options || options.fps !== 60) throw new Error("协议 v1 仅支持 fps: 60");
    ["viewport", "output"].forEach(name => {
      ["width", "height"].forEach(axis => {
        if (!Number.isSafeInteger(options[name]?.[axis]) || options[name][axis] <= 0) {
          throw new Error(`${name}.${axis} 必须是正整数`);
        }
      });
    });
    if (!Number.isFinite(options.deviceScaleFactor) || options.deviceScaleFactor <= 0) {
      throw new Error("deviceScaleFactor 必须是有限正数");
    }
    ["width", "height"].forEach(axis => {
      if (Math.abs(options.output[axis] - options.viewport[axis] * options.deviceScaleFactor) > 1) {
        throw new Error(`output.${axis} 与 viewport 和 deviceScaleFactor 不匹配`);
      }
    });
    if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
      throw new Error("seed 必须是 uint32");
    }
    // 保留自己的不可变参数快照；目前所有效果均无随机因素。
    return Object.freeze({
      fps: 60,
      viewport: Object.freeze({ ...options.viewport }),
      output: Object.freeze({ ...options.output }),
      deviceScaleFactor: options.deviceScaleFactor,
      seed: options.seed
    });
  }

  global.__VIDEO_EXPORT__ = Object.freeze({
    version: 1,
    getManifest() {
      assertOpen();
      return application.getManifest();
    },
    async prepare(options) {
      assertOpen();
      if (preparing) throw new Error("prepare 正在执行");
      const snapshot = validateOptions(options);
      preparing = true;
      prepared = false;
      try {
        await application.prepare(snapshot);
        assertOpen();
        nextFrameIndex = 0;
        prepared = true;
      } finally {
        preparing = false;
      }
    },
    reset() {
      assertPrepared();
      application.reset();
      nextFrameIndex = 0;
    },
    renderFrame(frame) {
      assertPrepared();
      if (!frame || !Number.isSafeInteger(frame.index) || frame.index !== nextFrameIndex) {
        throw new Error(`supportsSeeking: false，请顺序提交全局帧 ${nextFrameIndex}`);
      }
      const expectedTime = frame.index * 1000 / 60;
      const expectedDelta = frame.index === 0 ? 0 : 1000 / 60;
      if (!Number.isFinite(frame.timeMs) || Math.abs(frame.timeMs - expectedTime) > 1e-6
          || !Number.isFinite(frame.deltaMs) || Math.abs(frame.deltaMs - expectedDelta) > 1e-6) {
        throw new Error("帧时间必须使用 index * 1000 / 60；首帧 deltaMs 为 0，其余为 1000 / 60");
      }
      application.renderFrame(frame);
      nextFrameIndex += 1;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      prepared = false;
      application.dispose();
    }
  });
}(globalThis));
