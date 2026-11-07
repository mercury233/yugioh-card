import test from 'node:test';
import assert from 'node:assert/strict';
import { YugiohCard } from '../index.js';

test('card names forward theme and variant selection', () => {
  for (const fullArt of [false, true]) {
    let options;
    YugiohCard.prototype.drawName.call({
      data: { name: 'ABC', fullArt, language: 'en', gradientTheme: 'gold' },
      fullArt,
      style: { name: { fontFamily: 'ygo-en-name', fontSize: 24 } },
      nameLeaf: { set(value) { options = value; } },
    });
    assert.equal(options.gradientTheme, 'gold');
    assert.equal(options.fullArt, fullArt);
    assert.equal(options.language, 'en');
  }
});

test('rendering uses explicit full-art mode without inferring it from image dimensions', () => {
  for (const fullArt of [false, true]) {
    const calls = [];
    const target = { data: { image: 'missing-image.png', imageAspectRatio: 0.5, fullArt }, fullArt };
    for (const name of Object.getOwnPropertyNames(YugiohCard.prototype)) {
      if (name.startsWith('draw') && name !== 'draw') target[name] = () => calls.push(name);
    }
    target.updateScale = () => {};
    YugiohCard.prototype.draw.call(target);
    assert.equal(calls.includes('drawFullArt'), fullArt);
    assert.equal(calls.includes('drawImage'), !fullArt);
  }
});

test('pendulum image dimensions use caller-provided aspect ratio', () => {
  for (const [imageAspectRatio, height] of [[1.5, 438], [1, 749], [0.8, 749]]) {
    let options;
    YugiohCard.prototype.drawImage.call({
      data: { type: 'pendulum', image: 'missing-image.png', imageAspectRatio },
      imageAspectRatio,
      imageLeaf: { set(value) { options = value; } },
    });
    assert.equal(options.height, height);
  }
});
