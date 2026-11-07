import test from 'node:test';
import assert from 'node:assert/strict';
import { useCanvas } from '#leafer';
import skia from 'skia-canvas';
import { loadFontNode } from '../../utils/index.js';
import { CompressText } from '../compress-text.js';

useCanvas('skia', skia);
loadFontNode('./src/assets/yugioh-card/yugioh/font', skia);

const baseConfig = { fontFamily: 'ygo-en', fontSize: 20, lineHeight: 1.05, width: 120 };
const text = 'one two three four five six seven eight';
const snapshot = instance => ({
  bounds: { ...instance.bounds },
  fontScale: instance.renderFontScale,
  textScale: instance.textScale,
  lineHeightScale: instance.lineHeightScale,
  chars: instance.parseList.flatMap(item => item.ruby.charList).map(char => ({
    text: char.text, line: char.line, x: char.charLeaf.x, y: char.charLeaf.y,
    visible: char.charLeaf.visible, fontSize: char.charLeaf.fontSize, scaleX: char.charLeaf.scaleX,
  })),
});

test('automatic shrinking preserves configured scale and recovers on update', () => {
  const instance = new CompressText({ ...baseConfig, text, height: 15 });
  const fresh = new CompressText({ ...baseConfig, text: 'ABC', height: 100 });
  try {
    assert.equal(instance.fontScale, 1);
    assert.ok(instance.renderFontScale < 1);
    instance.set({ text: 'ABC', height: 100 });
    assert.deepEqual(snapshot(instance), snapshot(fresh));
  } finally {
    instance.destroy();
    fresh.destroy();
  }
});

test('trial layouts preserve space nodes and restore final positions', () => {
  const instance = new CompressText({ ...baseConfig, text, height: 1000 });
  try {
    const before = snapshot(instance);
    const chars = instance.parseList.flatMap(item => item.ruby.charList);
    const leaves = chars.map(char => char.charLeaf);
    for (const scale of [0.65, 1, 0.8, 1]) {
      instance.textScale = scale;
      instance.updateTextScale();
      instance.alignRuby();
      instance.createBounds();
      chars.forEach((char, index) => {
        assert.equal(char.charLeaf, leaves[index]);
        assert.ok(!char.charLeaf.destroyed);
        assert.equal(char.charLeaf.visible, char.line >= 0);
      });
    }
    assert.deepEqual(snapshot(instance), before);
  } finally {
    instance.destroy();
  }
});

test('punctuation wrapping keeps each ruby group on one line without an initial blank line', () => {
  for (const width of [65, 75, 100, 150]) {
    for (const value of ['[甲乙丙(こうおつへい)]。丁', '前前[甲乙丙(abc)]。丁']) {
      const instance = new CompressText({ text: value, fontFamily: 'ygo-jp', fontSize: 24, width });
      try {
        for (const item of instance.parseList.filter(item => item.rt.text)) {
          assert.equal(new Set(item.ruby.charList.map(char => char.line)).size, 1);
          assert.ok(Number.isFinite(item.rt.rtLeaf.x));
        }
        assert.equal(Math.min(...instance.parseList.flatMap(item => item.ruby.charList).map(char => char.line)), 0);
      } finally {
        instance.destroy();
      }
    }
  }
});

test('default reset and local gradient configuration remain available', () => {
  const instance = new CompressText({ ...baseConfig, text: 'ABC', fontScale: 1.2, gradient: true, gradientStrokeAlpha: 0.35 });
  try {
    assert.equal(instance.defaultData.fontScale, 1);
    instance.set({ fontScale: undefined });
    assert.equal(instance.fontScale, 1);
    const leaf = instance.parseList[0].ruby.charList[0].charLeaf;
    assert.equal(leaf.stroke, 'rgba(0, 0, 0, 0.35)');
    assert.ok(leaf.innerShadow);
    assert.ok(!Object.hasOwn(instance.defaultData, 'textJustifyLast'));
  } finally {
    instance.destroy();
  }
});
