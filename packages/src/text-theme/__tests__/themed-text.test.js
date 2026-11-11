import test from 'node:test';
import assert from 'node:assert/strict';
import { useCanvas } from 'leafer-unified';
import skia from 'skia-canvas';
import { ThemedText } from '../themed-text.js';
import { gradientThemes } from '../themes.js';
import { YugiohCard } from '../../yugioh-card/index.js';
import { YugiohSeries2Card } from '../../yugioh-series-2-card/index.js';

useCanvas('skia', skia);

test('legacy gradient parameters override themes and full-art variants', () => {
  for (const gradientTheme of ['', 'gold']) {
    const instance = new ThemedText({
      text: 'ABC', fontFamily: 'Arial', fontSize: 24, gradientTheme,
      gradient: true, fullArt: true, language: 'en',
      gradientColor1: '#123456', gradientColor2: '#abcdef',
      gradientStrokeAlpha: 0, gradientStrokeWidthRate: 0,
    });
    try {
      let leaf = instance.rubyList[0].rubyLeaf;
      assert.equal(leaf.fill.stops[0].color, '#123456');
      assert.equal(leaf.fill.stops[1].color, '#abcdef');
      assert.equal(leaf.stroke, 'rgba(0, 0, 0, 0)');
      assert.equal(leaf.strokeWidth, 0);
      instance.set({ gradient: false });
      leaf = instance.rubyList[0].rubyLeaf;
      assert.equal(leaf.fill, 'black');
      assert.ok(!leaf.innerShadow);
      instance.set({ gradient: null, gradientColor1: null, gradientColor2: null, gradientStrokeAlpha: null, gradientStrokeWidthRate: null });
      leaf = instance.rubyList[0].rubyLeaf;
      if (gradientTheme) {
        assert.equal(leaf.fill.stops[0].color, '#e0e0c0');
        assert.equal(leaf.stroke, 'rgba(0, 0, 0, 0.1)');
      } else {
        assert.equal(leaf.fill, 'black');
      }
    } finally {
      instance.destroy();
    }
  }
});

test('preset themes retain normal, full-art and English styles', () => {
  const before = structuredClone(gradientThemes);
  for (const [gradientTheme, color1, color2] of [
    ['silver', '#c0c0c0', '#ffffff'], ['gold', '#ffd700', '#fff000'], ['platinum', '#999999', '#ffffff'],
  ]) {
    for (const fullArt of [false, true]) {
      for (const language of ['jp', 'en']) {
        const instance = new ThemedText({ text: 'ABC', fontFamily: 'Arial', fontSize: 24, gradientTheme, fullArt, language });
        try {
          const leaf = instance.rubyList[0].rubyLeaf;
          assert.deepEqual(leaf.fill.stops.map(stop => stop.color), fullArt
            ? ['#e0e0c0', '#ffffff', '#ffffff', '#e0e0c0', '#ffffff']
            : [color1, color2, color2, color1, color2]);
          assert.equal(leaf.stroke, `rgba(0, 0, 0, ${language === 'en' ? 0.1 : fullArt ? 0.5 : 0.2})`);
          assert.equal(leaf.strokeWidth, 24 * (language === 'en' ? 0.015 : 0.025));
          assert.ok(leaf.innerShadow);
        } finally {
          instance.destroy();
        }
      }
    }
  }
  assert.deepEqual(gradientThemes, before);
});

test('theme changes, disabling and subsequent layouts leave no stale styles', () => {
  const instance = new ThemedText({ text: 'ABC', fontFamily: 'Arial', color: '#123456', gradientTheme: 'gold' });
  try {
    instance.set({ gradientTheme: 'silver', fullArt: true, language: 'en' });
    instance.compressText();
    assert.equal(instance.rubyList[0].rubyLeaf.stroke, 'rgba(0, 0, 0, 0.1)');
    assert.equal(instance.rubyList[0].rubyLeaf.fill.stops[0].color, '#e0e0c0');
    for (const gradientTheme of ['', 'unknown', 'toString', undefined]) {
      instance.set({ gradientTheme });
      const leaf = instance.rubyList[0].rubyLeaf;
      assert.equal(leaf.fill, '#123456');
      assert.ok(!leaf.stroke);
      assert.ok(!leaf.innerShadow);
    }
  } finally {
    instance.destroy();
  }
});

test('theme widths and shadows follow the final automatically reduced font size', () => {
  const instance = new ThemedText({ text: 'one two three four five six seven eight', fontFamily: 'Arial', fontSize: 24, width: 100, height: 25, gradientTheme: 'gold' });
  try {
    assert.ok(instance.renderFontScale < 1);
    const fontSize = instance.fontSize * instance.renderFontScale;
    for (const ruby of instance.rubyList) {
      assert.equal(ruby.rubyLeaf.strokeWidth, fontSize * 0.025);
      assert.equal(ruby.rubyLeaf.innerShadow.blur, fontSize * 0.005);
    }
  } finally {
    instance.destroy();
  }
});

test('both card renderers create themed name leaves', () => {
  for (const CardClass of [YugiohCard, YugiohSeries2Card]) {
    const target = {
      data: { name: 'ABC', gradientTheme: 'gold', language: 'en', fullArt: true },
      fullArt: true,
      style: { name: { fontFamily: 'Arial', fontSize: 24, top: 0 } },
      autoNameColor: '#000000', leafer: { add() {} },
    };
    try {
      CardClass.prototype.drawName.call(target);
      assert.ok(target.nameLeaf instanceof ThemedText);
      assert.equal(target.nameLeaf.rubyList[0].rubyLeaf.stroke, 'rgba(0, 0, 0, 0.1)');
    } finally {
      target.nameLeaf?.destroy();
    }
  }
});
