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
    text: char.text, line: char.line, x: char.rubyLeaf.x, y: char.rubyLeaf.y,
    visible: char.rubyLeaf.visible, fontSize: char.rubyLeaf.fontSize, scaleX: char.rubyLeaf.scaleX,
  })),
});

test('bounds skip empty lines left by wrapped leading spaces', () => {
  for (const value of [' ABC', '   ABC', 'A   B']) {
    const instance = new CompressText({ text: value, width: 10, fontSize: 20, fontFamily: 'ygo-en' });
    try {
      assert.ok([...instance.rubyLineMap.values()].some(line => line.length === 0));
      assert.ok(Number.isFinite(instance.bounds.width));
      assert.ok(Number.isFinite(instance.bounds.height));
      assert.ok(instance.bounds.width > 0);
      assert.ok(instance.bounds.height > 0);
      const before = { ...instance.bounds };
      instance.createBounds();
      assert.deepEqual(instance.bounds, before);
    } finally {
      instance.destroy();
    }
  }
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

test('automatic shrinking preserves word spacing after repeated font measurements', () => {
  for (const wordSpacing of [10, -1, 0]) {
    const instance = new CompressText({ ...baseConfig, text, height: 15, wordSpacing });
    try {
      assert.ok(instance.renderFontScale < 0.95);
      const spaces = instance.parseList.flatMap(item => item.ruby.charList).filter(char => char.text === ' ');
      assert.ok(spaces.length > 0);
      for (const char of spaces) {
        const expectedWidth = char.rubyLeaf.textDrawData.bounds.width + wordSpacing;
        assert.equal(char.originalWidth, expectedWidth);
        assert.equal(char.width, expectedWidth * instance.textScale);
      }
    } finally {
      instance.destroy();
    }
  }
});

test('trial layouts preserve space nodes and restore final positions', () => {
  const instance = new CompressText({ ...baseConfig, text, height: 1000 });
  try {
    const before = snapshot(instance);
    const chars = instance.parseList.flatMap(item => item.ruby.charList);
    const leaves = chars.map(char => char.rubyLeaf);
    for (const scale of [0.65, 1, 0.8, 1]) {
      instance.textScale = scale;
      instance.updateTextScale();
      instance.alignRuby();
      instance.createBounds();
      chars.forEach((char, index) => {
        assert.equal(char.rubyLeaf, leaves[index]);
        assert.ok(!char.rubyLeaf.destroyed);
        assert.equal(char.rubyLeaf.visible, char.line >= 0);
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
    const leaf = instance.parseList[0].ruby.charList[0].rubyLeaf;
    assert.equal(leaf.stroke, 'rgba(0, 0, 0, 0.35)');
    assert.ok(leaf.innerShadow);
    assert.equal(instance.textJustifyLast, false);
  } finally {
    instance.destroy();
  }
});

test('fitting text skips height search while overflowing text still compresses', () => {
  class CountingCompressText extends CompressText {
    updateTextScale() {
      this.layoutCount = (this.layoutCount || 0) + 1;
      super.updateTextScale();
    }
  }
  const reference = new CompressText({ ...baseConfig, text });
  const instance = new CountingCompressText({ ...baseConfig, text, height: reference.bounds.height });
  try {
    assert.equal(instance.layoutCount, 1);
    assert.deepEqual(snapshot(instance), snapshot(reference));
    instance.layoutCount = 0;
    instance.set({ height: 15 });
    assert.ok(instance.layoutCount > 1);
    assert.ok(instance.renderFontScale < 1);
  } finally {
    instance.destroy();
    reference.destroy();
  }
});

test('multiline bounds apply group scaling once after combining lines', () => {
  const instance = new CompressText({ ...baseConfig, text: 'one two three\nx\ny', width: 300, textAlign: 'left' });
  try {
    assert.equal(instance.currentLine, 2);
    const unscaledBounds = { ...instance.bounds };
    for (const [scaleX, scaleY] of [[2, 3], [0.5, 0.75], [1, 1]]) {
      instance.set({ scaleX, scaleY });
      const expectedBounds = {
        width: unscaledBounds.width * scaleX,
        height: unscaledBounds.height * scaleY,
      };
      assert.deepEqual(instance.bounds, expectedBounds);
      instance.createBounds();
      assert.deepEqual(instance.bounds, expectedBounds);
    }
  } finally {
    instance.destroy();
  }
});

test('malformed ruby stays plain without swallowing following valid ruby', () => {
  for (const malformed of ['[(abc)]', '[broken', '[甲(abc]', '[甲abc)]', '[甲(a(b)c)]', '[甲(a]b)]', '[甲\n乙(abc)]', '[甲(a\nb)]', '[甲\r乙(abc)]']) {
    const instance = new CompressText({ ...baseConfig, text: `${malformed}[乙(おつ)]` });
    try {
      assert.equal(instance.parseList.map(item => item.ruby.text).join(''), `${malformed}乙`);
      assert.deepEqual(instance.parseList.filter(item => item.rt.text).map(item => [item.ruby.text, item.rt.text]), [['乙', 'おつ']]);
      assert.ok(Number.isFinite(instance.bounds.width));
      assert.ok(Number.isFinite(instance.bounds.height));
    } finally {
      instance.destroy();
    }
  }
});

test('ruby parsing preserves adjacent tokens, bold, newlines and empty readings', () => {
  const instance = new CompressText({ ...baseConfig, text: '<b>[甲(こう)][乙(おつ)]</b>\n[丙()]●[①(いち)]' });
  try {
    assert.deepEqual(instance.parseList.map(item => [item.ruby.text, item.rt.text, item.ruby.bold]), [
      ['甲', 'こう', true], ['乙', 'おつ', true], ['\n', '', false],
      ['丙', '', false], ['●', '', false], ['①', 'いち', false],
    ]);
  } finally {
    instance.destroy();
  }
});

test('line caches follow punctuation moves, hidden spaces and text replacement', () => {
  const instance = new CompressText({ ...baseConfig });
  try {
    for (const value of [text, '前前[甲乙丙(abc)]。丁  戊\n后文', 'one  two\nthree four', '', 'ABC']) {
      instance.set({ text: value, width: 75 });
      const chars = instance.parseList.flatMap(item => item.ruby.charList);
      assert.deepEqual(instance.rubyList, chars);
      assert.equal(instance.charInfoMap.size, chars.length);
      for (const scale of [0.65, 1, 0.8, 1]) {
        instance.textScale = scale;
        instance.updateTextScale();
        instance.alignRuby();
        const groupedChars = [...instance.rubyLineMap.values()].flat();
        assert.deepEqual(groupedChars, chars.filter(char => char.line >= 0));
        for (const [line, lineList] of instance.rubyLineMap) {
          assert.deepEqual(lineList, chars.filter(char => char.line === line));
        }
        chars.forEach((char, index) => {
          assert.equal(instance.charInfoMap.get(char).previousChar, chars[index - 1]);
          assert.equal(char.rubyLeaf.visible, char.line >= 0);
        });
      }
    }
  } finally {
    instance.destroy();
  }
});

test('overflow wrapping restores the original layout when disabled', () => {
  const value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const instance = new CompressText({ text: value, fontFamily: 'Arial', fontSize: 24, width: 60, overflowWrap: false });
  try {
    const before = snapshot(instance);
    assert.equal(instance.overflowWrap, false);
    assert.ok(instance.bounds.width > instance.width);
    instance.set({ overflowWrap: true });
    assert.ok(instance.currentLine > 0);
    assert.ok(instance.bounds.width <= instance.width);
    assert.equal(instance.rubyList.map(ruby => ruby.text).join(''), value);
    instance.set({ overflowWrap: false });
    assert.deepEqual(snapshot(instance), before);
  } finally {
    instance.destroy();
  }
});

test('overflow wrapping preserves bold, surrogate pairs and indivisible ruby groups', () => {
  const instance = new CompressText({
    text: '<b>ABCDEFGHIJKLMNOPQRSTUVWXYZ</b>\n[A(abcdefghijklmnop)]\n𠮷𠮷𠮷',
    fontFamily: 'Arial', fontSize: 24, width: 60, overflowWrap: true,
  });
  try {
    assert.ok(instance.parseList[0].ruby.charList.length > 1);
    assert.ok(instance.parseList[0].ruby.charList.every(ruby => ruby.rubyLeaf.fontWeight === 'bold'));
    assert.equal(instance.rubyList.map(ruby => ruby.text).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nA\n𠮷𠮷𠮷');
    assert.ok(instance.rubyList.every(ruby => ruby.text.isWellFormed()));
    const item = instance.parseList.find(item => item.rt.text);
    assert.equal(new Set(item.ruby.charList.map(ruby => ruby.line)).size, 1);
    assert.equal(item.ruby.charList.length, 1);
    instance.set({ text: 'W', width: 1 });
    assert.equal(instance.rubyList.length, 1);
    assert.ok(Number.isFinite(instance.bounds.width));
  } finally {
    instance.destroy();
  }
});

test('last-line justification is opt-in and reversible', () => {
  const instance = new CompressText({ ...baseConfig, text: 'one two', width: 200 });
  try {
    const before = snapshot(instance);
    assert.ok(instance.bounds.width < instance.width);
    instance.set({ textJustifyLast: true });
    assert.ok(Math.abs(instance.bounds.width - instance.width) < 1e-8);
    instance.set({ textJustifyLast: false });
    assert.deepEqual(snapshot(instance), before);
  } finally {
    instance.destroy();
  }
});

test('ruby expansion followed by shrinking remeasures existing readings', () => {
  const instance = new CompressText({
    text: '[A(abcdefghijklmnop)] B C D E F G H I J K L M N O P Q R S T',
    fontFamily: 'Arial', rtFontFamily: 'Arial', fontSize: 24, rtFontSize: 13,
    width: 100, height: 80,
  });
  try {
    assert.ok(instance.needCompressTwice);
    assert.ok(instance.renderFontScale < 1);
    const rt = instance.parseList[0].rt;
    assert.equal(rt.rtLeaf.fontSize, instance.rtFontSize * instance.renderFontScale);
    assert.equal(rt.rtLeaf.lineHeight, instance.rtFontSize * instance.rtLineHeight * instance.renderFontScale);
    assert.ok(instance.bounds.height <= instance.height);
    const measured = new CompressText({
      text: '[A(abcdefghijklmnop)]', fontFamily: 'Arial', rtFontFamily: 'Arial',
      fontSize: 24, rtFontSize: 13, fontScale: instance.renderFontScale,
    });
    try {
      assert.equal(rt.originalWidth, measured.parseList[0].rt.originalWidth);
    } finally {
      measured.destroy();
    }
  } finally {
    instance.destroy();
  }
});

test('empty first-line compression keeps a finite scale', () => {
  const instance = new CompressText({ text: '', width: 120, firstLineCompress: true });
  try {
    assert.equal(instance.firstLineTextScale, 1);
    assert.deepEqual(instance.bounds, { width: 0, height: 0 });
  } finally {
    instance.destroy();
  }
});

test('gradient stroke parameters are independent of the font family', () => {
  for (const fontFamily of ['ygo-en-name', 'ygo-sc']) {
    const instance = new CompressText({ text: 'ABC', fontFamily, fontSize: 24, gradient: true });
    try {
      for (const [alpha, rate] of [[0.1, 0.015], [0.35, 0.04], [0, 0]]) {
        instance.set({ gradientStrokeAlpha: alpha, gradientStrokeWidthRate: rate });
        const leaf = instance.rubyList[0].rubyLeaf;
        assert.equal(leaf.stroke, `rgba(0, 0, 0, ${alpha})`);
        assert.equal(leaf.strokeWidth, 24 * rate);
      }
      instance.set({ gradientStrokeAlpha: undefined, gradientStrokeWidthRate: undefined });
      const leaf = instance.rubyList[0].rubyLeaf;
      assert.equal(leaf.stroke, 'rgba(0, 0, 0, 0.2)');
      assert.equal(leaf.strokeWidth, 24 * 0.025);
    } finally {
      instance.destroy();
    }
  }
});
