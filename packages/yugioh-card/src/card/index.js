import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Text, Image, ImageEvent, Leafer, useCanvas } from '@leafer-ui/node';
import skia from 'skia-canvas';
//import loaderIcon from '../svg/loader.svg';
//import imageIcon from '../svg/image.svg';

const loadedCss = {};
// 动态加载css
function loadCSS(url) {
  if (loadedCss[url]) return;
  const text = readFileSync(url, 'utf-8');
  const cssDir = dirname(url);

  // 匹配 @font-face 规则
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;

  while ((match = fontFaceRegex.exec(text)) !== null) {
    const fontFaceContent = match[1];

    // 提取 font-family
    const familyMatch = fontFaceContent.match(/font-family:\s*["']([^"']+)["']/);
    if (!familyMatch) continue;

    const fontFamily = familyMatch[1];

    // 提取所有 url
    const urlRegex = /url\(["']?([^)"']+)["']?\)/g;
    const fontUrls = [];
    let urlMatch;

    while ((urlMatch = urlRegex.exec(fontFaceContent)) !== null) {
      const fontUrl = urlMatch[1];
      // 处理相对路径
      const absolutePath = resolve(cssDir, fontUrl);
      fontUrls.push(absolutePath);
    }

    if (fontUrls.length > 0) {
      try {
        skia.FontLibrary.use(fontFamily, fontUrls);
        //console.log(`Loaded font: ${fontFamily}`);
        loadedCss[url] = true;
      } catch (error) {
        console.error(`Failed to load font: ${fontFamily}`, fontUrls, error);
      }
    }
  }
};

export function resetAttr() {
  Text.changeAttr('lineHeight', {
    type: 'percent',
    value: 1.15,
  });
}

export class Card {
  leafer = null;
  imageStatusLeaf = null;
  cardWidth = 100;
  cardHeight = 100;
  data = {};
  timer = null;
  view = null;
  resourcePath = null;

  constructor(data = {}) {
    this.view = data.view;
    this.resourcePath = data.resourcePath;

    resetAttr();
    //loadCSS(`${this.resourcePath}/custom-font/custom-font.css`);
    loadCSS(`${this.resourcePath}/yugioh/font/ygo-font.css`);
    //loadCSS(`${this.resourcePath}/rush-duel/font/rd-font.css`);

    useCanvas('skia', skia);
  }

  setData(data = {}) {
    Object.assign(this.data, data);
    this.draw();
  }

  initLeafer() {
    this.leafer = new Leafer({
      view: this.view,
      type: 'block',
      width: this.cardWidth,
      height: this.cardHeight,
    });
  }

  draw() {
    // need to be overridden
  }

  listenImageStatus(imageLeaf) {
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
    /*
    if (status === ImageEvent.LOAD) {
      statusUrl = loaderIcon;
    } else if (status === ImageEvent.ERROR) {
      statusUrl = imageIcon;
    }
    */

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

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (status === ImageEvent.LOAD) {
      this.timer = setInterval(() => {
        this.imageStatusLeaf.rotateOf('center', 3);
      }, 16.7);
    }
  }

  updateScale() {
    const ratio = 1; // devicePixelRatio
    this.leafer.width = this.cardWidth * this.data.scale / ratio;
    this.leafer.height = this.cardHeight * this.data.scale / ratio;
    this.leafer.scaleX = this.data.scale / ratio;
    this.leafer.scaleY = this.data.scale / ratio;
  }
}
