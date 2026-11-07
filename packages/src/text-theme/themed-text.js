import { CompressText } from '../compress-text/index.js';
import { gradientThemes } from './themes.js';

const gradientStops = [0, 0.4, 0.55, 0.6, 0.75];

export class ThemedText extends CompressText {
  initData(data = {}) {
    Object.assign(this.defaultData, {
      gradientTheme: '', fullArt: false, language: '',
      gradient: null, gradientColor1: null, gradientColor2: null,
      gradientStrokeAlpha: null, gradientStrokeWidthRate: null,
    });
    super.initData(data);
  }

  /**
   * 在每次完整排版后应用主题，包括字体加载完成后的重排。
   * 叶子由父类重建，因此切换主题或关闭渐变时不会残留上一轮描边和阴影。
   */
  compressText() {
    super.compressText();
    if (this.gradient === false) return;
    const hasOverrides = [this.gradientColor1, this.gradientColor2, this.gradientStrokeAlpha, this.gradientStrokeWidthRate].some(value => value != null);
    const theme = Object.hasOwn(gradientThemes, this.gradientTheme)
      ? gradientThemes[this.gradientTheme]
      : this.gradient || hasOverrides ? gradientThemes.platinum : null;
    if (!theme) return;

    // 语言变体最后应用，确保英文的细描边在 fullArt 模式下也保持一致。
    const style = { ...theme, ...(this.fullArt ? theme.fullArt : {}), ...theme.languages?.[this.language] };
    // 旧参数也可覆盖主题变体，零透明度和零描边宽度均为有效配置。
    style.color1 = this.gradientColor1 ?? style.color1;
    style.color2 = this.gradientColor2 ?? style.color2;
    style.strokeAlpha = this.gradientStrokeAlpha ?? style.strokeAlpha;
    style.strokeWidthRate = this.gradientStrokeWidthRate ?? style.strokeWidthRate;
    const fontSize = this.fontSize * this.renderFontScale;
    this.rubyList.forEach(ruby => {
      ruby.rubyLeaf.set({
        fill: {
          type: 'linear',
          from: 'top-left',
          to: 'bottom-right',
          stops: gradientStops.map((offset, index) => ({ offset, color: index === 0 || index === 3 ? style.color1 : style.color2 })),
        },
        stroke: `rgba(0, 0, 0, ${style.strokeAlpha})`,
        strokeWidth: fontSize * style.strokeWidthRate,
        strokeAlign: 'outside',
        innerShadow: {
          color: style.innerShadow.color,
          blur: fontSize * style.innerShadow.blurRate,
          x: fontSize * style.innerShadow.offsetXRate,
          y: fontSize * style.innerShadow.offsetYRate,
        },
      });
    });
  }
}
