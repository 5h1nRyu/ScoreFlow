// 项目公共配置。后续的可配置项统一添加到此对象中。
const APP_CONFIG = Object.freeze({
  backgroundColor: "#ffffff"
});

// 将背景颜色提供给样式表使用。
document.documentElement.style.setProperty(
    "--background-color",
    APP_CONFIG.backgroundColor
);
