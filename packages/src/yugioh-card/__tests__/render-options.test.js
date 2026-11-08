import test from 'node:test';
import assert from 'node:assert/strict';
import { YugiohCard } from '../index.js';
import { YugiohSeries2Card } from '../../yugioh-series-2-card/index.js';

test('monster type height controls description placement independently of typography', () => {
  for (const CardClass of [YugiohCard, YugiohSeries2Card]) {
    let descriptionOptions;
    let monsterTypeOptions;
    const target = {
      data: { type: 'monster', language: 'sc', monsterType: '龙族/通常', atkBar: true },
      style: {
        monsterType: { top: 742, height: 30, minHeight: 4, fontSize: 22, lineHeight: 1.15 },
        description: { fontSize: 18, lineHeight: 1.17 },
      },
      showMonsterType: true,
      monsterTypeLeaf: { set(value) { monsterTypeOptions = value; } },
      descriptionLeaf: { set(value) { descriptionOptions = value; } },
    };
    for (const fontSize of [22, 26]) {
      target.style.monsterType.fontSize = fontSize;
      for (const height of [30, 40]) {
        target.style.monsterType.height = height;
        CardClass.prototype.drawMonsterType.call(target);
        CardClass.prototype.drawDescription.call(target);
        assert.equal(monsterTypeOptions.height, height);
        assert.equal(descriptionOptions.y, 742 + height);
        if (CardClass === YugiohCard) assert.equal(descriptionOptions.height, 180 - height - 27);
      }
    }
    target.showMonsterType = false;
    CardClass.prototype.drawDescription.call(target);
    assert.equal(descriptionOptions.y, 746);
  }
});

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
