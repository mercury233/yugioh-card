import test from 'node:test';
import assert from 'node:assert/strict';
import { useCanvas } from '#leafer';
import skia from 'skia-canvas';

useCanvas('skia', skia);

test('fonts loaded after initial readiness rebuild text positions and stop updating destroyed text', async t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const fonts = new EventTarget();
  fonts.ready = Promise.resolve();
  globalThis.document = { fonts };
  globalThis.window = { document: globalThis.document };
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  const { CompressText } = await import('../compress-text.js');
  const instance = new CompressText({ text: '【龙族/通常】', fontFamily: 'Arial', fontSize: 24 });
  await fonts.ready;
  const oldGroup = instance.group;
  const reflow = t.mock.method(instance, 'compressText');
  fonts.dispatchEvent(new Event('loadingdone'));
  assert.equal(reflow.mock.callCount(), 1);
  assert.notEqual(instance.group, oldGroup);
  assert.equal(oldGroup.destroyed, true);
  assert.equal(instance.group.children.length > 0, true);
  instance.destroy();
  fonts.dispatchEvent(new Event('loadingdone'));
  assert.equal(reflow.mock.callCount(), 1);

  const destroyedBeforeReady = new CompressText({ text: 'ABC' });
  const destroyedReflow = t.mock.method(destroyedBeforeReady, 'compressText');
  destroyedBeforeReady.destroy();
  await fonts.ready;
  assert.equal(destroyedReflow.mock.callCount(), 0);
});
