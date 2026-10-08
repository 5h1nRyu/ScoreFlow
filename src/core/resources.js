(function exposeResources(global) {
  "use strict";

  // decode 同时等待下载和解码；缺图在 prepare 完成前确定，不留到某一帧才报错。
  async function prepareImage(image, required = false) {
    try {
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片尺寸无效");
    } catch (error) {
      if (required) throw new Error(`图片加载失败：${image.src}`, { cause: error });
      image.classList.add(`${image.classList[0]}--missing`);
      image.removeAttribute("src");
    }
  }

  async function prepareFont(text) {
    const font = '400 16px "Alimama DongFangDaKai"';
    const faces = await document.fonts.load(font, text);
    await document.fonts.ready;
    if (!faces.length || faces.some(face => face.status !== "loaded") || !document.fonts.check(font, text)) {
      throw new Error("指定字体 Alimama DongFangDaKai 未成功加载");
    }
  }

  async function prepareBackground(required) {
    if (!APP_CONFIG.useBackgroundImage) return;
    const image = new Image();
    image.src = "assets/images/background/paper.jpg";
    await prepareImage(image, required);
  }

  global.ScoreResources = Object.freeze({ prepareImage, prepareFont, prepareBackground });
}(globalThis));
