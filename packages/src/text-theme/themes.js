const baseTheme = {
  strokeAlpha: 0.2,
  strokeWidthRate: 0.025,
  innerShadow: { color: 'rgba(0, 0, 0, 0.3)', blurRate: 0.005, offsetXRate: 0.015, offsetYRate: 0.015 },
  fullArt: { color1: '#e0e0c0', color2: '#ffffff', strokeAlpha: 0.5 },
  languages: { en: { strokeAlpha: 0.1, strokeWidthRate: 0.015 } },
};

export const gradientThemes = {
  silver: { ...baseTheme, color1: '#c0c0c0', color2: '#ffffff' },
  gold: { ...baseTheme, color1: '#ffd700', color2: '#fff000' },
  platinum: { ...baseTheme, color1: '#999999', color2: '#ffffff' },
};
