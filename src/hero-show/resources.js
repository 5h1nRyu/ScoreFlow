// 路径只来自配置。未配置的图片/纹理/字体不加载；已配置素材缺失会阻止导出。
async function loadFont(font, family) {
  if (!font?.src) return;
  const face = new FontFace(family, `url(${JSON.stringify(font.src)})`, { weight: String(font.weight), display: "block" });
  try {
    await face.load();
    document.fonts.add(face);
  } catch {
    throw new Error(`字体加载失败：${font.src}`);
  }
}

async function decodeImage(image, src) {
  try {
    await image.decode();
    if (!image.naturalWidth) throw new Error();
  } catch {
    throw new Error(`图片加载失败：${src}`);
  }
}

export async function loadResources({ assets }, stage) {
  await Promise.all([
    loadFont(assets.fonts?.title, "MatchTitle"),
    loadFont(assets.fonts?.score, "MatchScore"),
    ...[...stage.querySelectorAll("img[src]")].map((image) => decodeImage(image, image.getAttribute("src"))),
    ...[assets.background, assets.grain].filter(Boolean).map((src) => {
      const image = new Image();
      image.src = src;
      return decodeImage(image, src);
    }),
  ]);
  await document.fonts.ready;
}
