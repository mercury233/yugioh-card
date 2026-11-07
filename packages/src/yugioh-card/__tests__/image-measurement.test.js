import test from 'node:test';
import assert from 'node:assert/strict';
import skia from 'skia-canvas';
import { YugiohCard } from '../index.js';

class MeasurementCard extends YugiohCard {
  get tag() { return 'MeasurementCard'; }
  initLeafer() { this.leafer = { destroyed: false }; }
  draw() {
    this.draws ??= [];
    this.draws.push({ ratio: this.imageAspectRatio, fullArt: this.fullArt });
  }
}

test('ready waits for skia measurement and subsequent image changes reset automatic full-art state', async () => {
  const canvas = new skia.Canvas(50, 100);
  canvas.getContext('2d').fillRect(0, 0, 50, 100);
  const image = await canvas.toBuffer('png');
  const card = new MeasurementCard({ skia, data: { image } });
  assert.equal(card.draws, undefined);
  await card.ready;
  assert.equal(card.imageAspectRatio, 0.5);
  assert.equal(card.fullArt, true);
  assert.deepEqual(card.draws, [{ ratio: 0.5, fullArt: true }]);
  assert.equal(card.data.fullArt, null);
  await card.setData({ image: '' });
  assert.equal(card.fullArt, false);
  assert.equal(card.imageAspectRatio, 1);
  await card.setData({ image: 'nonexistent-image.png' });
  assert.equal(card.imageAspectRatio, 1);
  assert.equal(card.fullArt, false);
});

test('explicit overrides and skia versions with dispose remain supported', async () => {
  let loads = 0;
  let disposed = 0;
  const card = new MeasurementCard({
    skia: { ...skia, loadImage: async () => {
      loads++;
      return { width: 50, height: 100, dispose() { disposed++; } };
    } },
    data: { image: 'image', imageAspectRatio: 1.5, fullArt: false },
  });
  await card.ready;
  assert.equal(loads, 0);
  assert.equal(card.imageAspectRatio, 1.5);
  await card.setData({ imageAspectRatio: null });
  assert.equal(card.imageAspectRatio, 0.5);
  assert.equal(card.fullArt, false);
  assert.equal(disposed, 1);
  await card.setData({ fullArt: null });
  assert.equal(card.fullArt, true);
});

test('stale measurements and destroyed scenes do not redraw', async () => {
  const pending = new Map();
  const card = new MeasurementCard({
    skia: { ...skia, loadImage: source => new Promise(resolve => pending.set(source, resolve)) },
    data: { image: 'old' },
  });
  const oldReady = card.ready;
  const newReady = card.setData({ image: 'new' });
  pending.get('new')({ width: 150, height: 100 });
  await newReady;
  pending.get('old')({ width: 50, height: 100 });
  await oldReady;
  assert.deepEqual(card.draws, [{ ratio: 1.5, fullArt: false }]);
  const destroyedReady = card.setData({ image: 'destroyed' });
  card.leafer.destroyed = true;
  pending.get('destroyed')({ width: 50, height: 100 });
  await destroyedReady;
  assert.equal(card.draws.length, 1);
});

test('browser measurement waits for natural dimensions and handles overrides, failures and stale loads', async t => {
  const pending = new Map();
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  t.after(() => {
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else delete globalThis.Image;
  });
  globalThis.Image = class {
    set src(source) { pending.set(source, this); }
    width = 0;
    height = 0;
    naturalWidth = 50;
    naturalHeight = 100;
  };
  const card = new MeasurementCard({ skia });
  await card.ready;
  card.skia = null;
  card.draws = [];

  const portraitReady = card.setData({ image: 'portrait' });
  assert.equal(card.ready, portraitReady);
  assert.equal(card.draws.length, 0);
  const portrait = pending.get('portrait');
  portrait.onload();
  await portraitReady;
  assert.deepEqual(card.draws, [{ ratio: 0.5, fullArt: true }]);
  assert.equal(portrait.onload, null);
  assert.equal(portrait.onerror, null);

  await card.setData({ image: 'explicit', imageAspectRatio: 1.5, fullArt: false });
  assert.equal(pending.has('explicit'), false);
  assert.equal(card.imageAspectRatio, 1.5);
  const oldReady = card.setData({ image: 'old', imageAspectRatio: null, fullArt: null });
  const landscapeReady = card.setData({ image: 'landscape', type: 'pendulum' });
  pending.get('landscape').naturalWidth = 150;
  pending.get('landscape').onload();
  await landscapeReady;
  pending.get('old').onload();
  await oldReady;
  assert.equal(card.imageAspectRatio, 1.5);
  assert.equal(card.fullArt, false);
  let imageOptions;
  card.imageLeaf = { set(options) { imageOptions = options; } };
  card.drawImage();
  assert.equal(imageOptions.height, 438);
  assert.equal(card.draws.length, 3);

  const failedReady = card.setData({ image: 'failed' });
  const failed = pending.get('failed');
  failed.onerror();
  await failedReady;
  assert.equal(card.imageAspectRatio, 1);
  assert.equal(card.fullArt, false);
  assert.equal(failed.onload, null);
  assert.equal(failed.onerror, null);
  await card.setData({ image: '' });
  assert.equal(pending.has(''), false);
  assert.equal(card.imageAspectRatio, 1);

  const destroyedReady = card.setData({ image: 'destroyed' });
  const drawCount = card.draws.length;
  card.leafer.destroyed = true;
  pending.get('destroyed').onload();
  await destroyedReady;
  assert.equal(card.draws.length, drawCount);
});
