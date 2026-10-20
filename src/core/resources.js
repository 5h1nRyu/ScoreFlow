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
    const styles = getComputedStyle(document.documentElement);
    const fonts = [
      ['600 16px ' + styles.getPropertyValue("--heading-font-family").trim(), text],
      ['500 16px ' + styles.getPropertyValue("--title-font-family").trim(), APP_CONFIG.title.text]
    ];
    await Promise.all(fonts.map(([font, sample]) => document.fonts.load(font, sample)));
    await document.fonts.ready;
    if (fonts.some(([font, sample]) => !document.fonts.check(font, sample))) {
      throw new Error("界面字体未准备完成");
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
