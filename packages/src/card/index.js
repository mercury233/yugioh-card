import { Text, Image, ImageEvent, Leafer, LeaferEvent, Platform, useCanvas } from '#leafer';
import { isBrowser, isNode, loadFontBrowser, loadFontNode } from '../utils/index.js';
import loaderIconUrl from '../svg/loader.js';
import imageIconUrl from '../svg/image.js';

const fontPathMap = {
  YugiohCard: '/yugioh/font',
  YugiohSeries2Card: '/yugioh/font',
  RushDuelCard: '/rush-duel/font',
};

const resetAttr = () => {
  Text.changeAttr('lineHeight', {
    type: 'percent',
    value: 1.15,
  });
};

export class Card {
  leafer = null;
  imageStatusLeaf = null;
  cardWidth = 100;
  cardHeight = 100;
  data = {};
  view = null;
  resourcePath = null;
  skia = null;
  fontReady = Promise.resolve();
  ready = null;

  constructor(data = {}) {
    this.view = data.view;
    this.resourcePath = data.resourcePath;
    this.skia = data.skia;
    resetAttr();

    if (isNode) {
      if (!this.skia) {
        throw new Error('skia-canvas is required in Node environment');
      }
      useCanvas('skia', this.skia);
      // Skia 3.0.8 的 saveAs 别名未返回 Promise，优先使用 toFile；旧版仍使用 saveAs。
      Platform.origin.canvasSaveAs = (canvas, filename, quality) => (canvas.toFile || canvas.saveAs).call(canvas, filename, { quality });
    }

    const fontPath = fontPathMap[this.tag];
    if (fontPath) {
      if (isNode) {
        loadFontNode(`${this.resourcePath}${fontPath}`, this.skia); // 同步
      } else {
        this.fontReady = loadFontBrowser(`${this.resourcePath}${fontPath}`).catch(error => {
          console.warn('字体加载失败，使用默认字体绘制卡片', error);
        });
      }
    }
  }

  setData(data = {}) {
    Object.assign(this.data, data);
    if (isNode) {
      if (!this.leafer?.destroyed) this.draw();
      this.ready = Promise.resolve();
    } else {
      this.ready = this.fontReady.then(() => {
        if (!this.leafer?.destroyed) this.draw();
      });
    }
    return this.ready;
  }

  initLeafer() {
    this.leafer = new Leafer({
      view: this.view,
      width: this.cardWidth,
      height: this.cardHeight,
    });
    if (isNode) {
      // Leafer 2.3.3 会先销毁 watcher，再清空子节点；提前清空，避免 zIndex 排序更新访问已销毁的 watcher。
      this.leafer.once(LeaferEvent.END, () => this.leafer.clear());
    }
  }

  draw() {
    // need to be overridden
  }

  listenImageStatus(imageLeaf) {
    if (isNode) {
      return;
    }
    imageLeaf.on(ImageEvent.LOAD, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.LOAD);
    });
    imageLeaf.on(ImageEvent.LOADED, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.LOADED);
    });
    imageLeaf.on(ImageEvent.ERROR, () => {
      this.drawImageStatus(imageLeaf, ImageEvent.ERROR);
    });
  }

  drawImageStatus(imageLeaf, status) {
    const { url, width, height, x, y, zIndex } = imageLeaf;
    if (!this.imageStatusLeaf) {
      this.imageStatusLeaf = new Image();
      this.leafer.add(this.imageStatusLeaf);
    }

    let statusUrl = '';
    if (status === ImageEvent.LOAD) {
      statusUrl = loaderIconUrl;
    } else if (status === ImageEvent.ERROR) {
      statusUrl = imageIconUrl;
    }

    this.imageStatusLeaf.set({
      url: statusUrl,
      width: 120,
      height: 120,
      around: 'center',
      x: x + width / 2,
      y: y + height / 2,
      visible: [ImageEvent.LOAD, ImageEvent.ERROR].includes(status) && url,
      zIndex: zIndex + 1,
    });
  }

  updateScale() {
    const pixelRatio = isBrowser ? devicePixelRatio : 1;
    this.leafer.pixelRatio = pixelRatio;
    this.leafer.width = this.cardWidth * this.data.scale / pixelRatio;
    this.leafer.height = this.cardHeight * this.data.scale / pixelRatio;
    this.leafer.scaleX = this.data.scale / pixelRatio;
    this.leafer.scaleY = this.data.scale / pixelRatio;
  }
}
