import cloneDeep from 'lodash/cloneDeep.js';
import { Group, Text } from '@leafer-ui/node';
import { splitBreakWord } from './split-break-word.js';

export class CompressText extends Group {
  constructor(data = {}) {
    super();
    this.baseLineHeight = 1.15; // 基础行高
    this.noCompressText = '●①②③④⑤⑥⑦⑧⑨⑩'; // 不压缩的文本
    this.parseList = []; // 解析后的文本列表
    this.newlineList = []; // 根据换行符分割的文本列表
    this.currentX = 0; // 当前行的x坐标
    this.currentY = 0; // 当前行的y坐标
    this.currentLine = 0; // 当前行数
    this.textScale = 1; // 文本缩放比例
    this.lineHeightScale = 1; // 行距缩放比例
    this.firstLineTextScale = 1; // 首行文本缩放比例
    this.isSmallSize = false; // 是否是小文字
    this.group = null; // Leafer文本组
    this.needCompressTwice = false; // 是否需要二次压缩
    this.bounds = {}; // 宽高信息
    this.avoidStartChars = '。；：，、”」）·× '; // 避免在行首的字符
    this.avoidEndChars = '“「（●'; // 避免在行尾的字符

    this.defaultData = {
      text: '',
      fontFamily: 'ygo-sc, 楷体, serif',
      fontSize: 24,
      fontWeight: 'normal',
      lineHeight: this.baseLineHeight,
      letterSpacing: 0,
      wordSpacing: 0,
      firstLineCompress: false,
      textAlign: 'justify',
      textJustifyLast: false,
      color: 'black',
      strokeWidth: 0,
      gradient: false,
      gradientColor1: '#999999',
      gradientColor2: '#ffffff',
      rtFontFamily: 'ygo-tip, sans-serif',
      rtFontSize: 13,
      rtFontWeight: 'bold',
      rtLineHeight: this.baseLineHeight,
      rtLetterSpacing: 0,
      rtTop: -9,
      rtColor: 'black',
      rtStrokeWidth: 0,
      rtFontScaleX: 1,
      fontScale: 1,
      autoSmallSize: false,
      smallFontSize: 18,
      useScaleXForCompress: true, // 是否使用scaleX压缩，false时直接缩小字体
      key: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      zIndex: 0,
    };

    this.initData(data);
  }

  set(data = {}) {
    data = cloneDeep(data);
    let needCompressText = false;
    let needLoadFont = false;
    Object.keys(data).forEach(key => {
      const value = data[key] ?? this.defaultData[key];
      if (JSON.stringify(this[key]) !== JSON.stringify(value)) {
        this[key] = value;
        if (['fontFamily', 'rtFontFamily', 'key'].includes(key)) {
          needLoadFont = true;
        }
        needCompressText = true;
      }
    });
    if (needCompressText) {
      this.compressText();
    }
    // 先触发绘制，再触发字体加载
    if (needLoadFont) {
      this.loadFont();
    }
  }

  initData(data = {}) {
    this.set(Object.assign(this.defaultData, data));
  }

  loadFont() {
    //document.fonts.ready.finally(() => {
    //  this.compressText();
    //});
  }

  // 获取解析后的文本列表
  getParseList() {
    let bold = false;
    // 正则的捕获圆括号不要随意修改
    return String(this.text).trimEnd().split(new RegExp(`(\\[.*?\\(.*?\\)]|<b>|</b>|\n|[${this.noCompressText}])`)).filter(value => value).map(value => {
      let rubyText = value;
      let rtText = '';
      if (/\[.*?\(.*?\)]/g.test(value)) {
        rubyText = value.replace(/\[(.*?)\((.*?)\)]/g, '$1');
        rtText = value.replace(/\[(.*?)\((.*?)\)]/g, '$2');
      }
      if (value === '<b>') {
        bold = true;
        return null;
      }
      if (value === '</b>') {
        bold = false;
        return null;
      }
      return {
        ruby: {
          text: rubyText,
          bold,
          charList: splitBreakWord(rubyText).map(char => ({ text: char })),
        },
        rt: {
          text: rtText,
        },
      };
    }).filter(value => value);
  }

  // 获取换行列表
  getNewlineList() {
    const list = [[]];
    let currentIndex = 0;
    this.parseList.forEach(item => {
      const ruby = item.ruby;
      list[currentIndex].push(item);
      if (ruby.text === '\n') {
        currentIndex++;
        list[currentIndex] = [];
      }
    });
    return list;
  }

  // 获取压缩文本
  compressText() {
    this.textScale = 1;
    this.lineHeightScale = 1;
    this.firstLineTextScale = 1;
    this.isSmallSize = false;
    this.needCompressTwice = false;
    this.parseList = this.getParseList();
    this.newlineList = this.getNewlineList();
    if (this.group) {
      this.group.destroy();
    }
    this.group = new Group();
    this.createRuby();
    this.compressRuby();
    this.alignRuby();
    this.createRt();
    this.createGradient();
    this.createBounds();
    this.add(this.group);
  }

  // 创建文本
  createRuby() {
    this.parseList.forEach(item => {
      const ruby = item.ruby;
      const charList = ruby.charList;
      charList.forEach(char => {
        const charLeaf = new Text({
          text: char.text,
          fontFamily: this.fontFamily,
          fontSize: this.fontSize * this.fontScale,
          fontWeight: ruby.bold ? 'bold' : this.fontWeight,
          lineHeight: this.fontSize * this.lineHeight * this.fontScale,
          fill: this.color,
          stroke: this.strokeWidth ? this.color : null,
          strokeWidth: this.strokeWidth,
          strokeAlign: 'center',
          letterSpacing: this.letterSpacing,
        });
        const bounds = charLeaf.textDrawData.bounds;
        char.charLeaf = charLeaf;
        char.originalWidth = bounds.width;
        char.originalHeight = bounds.height;
        char.width = bounds.width;
        char.height = bounds.height;
        if (char.text === ' ') {
          char.originalWidth += this.wordSpacing;
          char.width += this.wordSpacing;
        }
        this.group.add(charLeaf);
      });
    });
    this.updateTextScale();
  }

  // 压缩文本
  compressRuby() {
    if (this.firstLineCompress && this.width) {
      // 首行压缩
      const firstNewlineCharList = this.newlineList[0].map(item => item.ruby.charList).flat();
      let firstNewlineTotalWidth = 0;
      let maxWidth = this.width;
      firstNewlineCharList.forEach(char => {
        const paddingLeft = char.paddingLeft || 0;
        const paddingRight = char.paddingRight || 0;
        firstNewlineTotalWidth += char.originalWidth;
        maxWidth -= paddingLeft + paddingRight;
      });
      this.firstLineTextScale = Math.min(Math.floor(maxWidth / firstNewlineTotalWidth * 1000) / 1000, 1);
      this.updateTextScale();
    }

    if (this.height) {
      this.optimizeTextToFitHeight();
    }
  }

  // 优化文本以适应高度
  optimizeTextToFitHeight() {
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    if (!charList.length) return;

    let bestTextScale = 1;
    let bestLineHeightScale = 1;
    let bestHeight = Number.MAX_VALUE;

    // 尝试不同的文本缩放和行距缩放组合
    for (let textScale = 1; textScale >= 0.6; textScale -= 0.02) {
      for (let lineHeightScale = 1; lineHeightScale >= 0.9; lineHeightScale -= 0.01) {
        this.textScale = textScale;
        this.lineHeightScale = lineHeightScale;
        this.updateTextScale();

        const lastChar = charList[charList.length - 1];
        const currentHeight = this.currentY + lastChar.height;

        if (currentHeight <= this.height) {
          if (Math.abs(currentHeight - this.height) < Math.abs(bestHeight - this.height)) {
            bestTextScale = textScale;
            bestLineHeightScale = lineHeightScale;
            bestHeight = currentHeight;
          }
          break; // 找到合适的行距缩放，不需要继续减小
        }
      }
    }

    // 如果仍然无法适应，尝试autoSmallSize
    if (bestHeight > this.height && this.autoSmallSize && this.fontScale <= 1 && !this.isSmallSize) {
      this.isSmallSize = true;
      this.updateFontSize();
      this.optimizeTextToFitHeight(); // 递归调用以重新优化
      return;
    }

    // 应用最佳的缩放比例
    this.textScale = bestTextScale;
    this.lineHeightScale = bestLineHeightScale;
    this.updateTextScale();
  }

  // 对齐ruby
  alignRuby() {
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    const alignLine = this.textScale < 1 || ['center', 'right'].includes(this.textAlign) || this.textJustifyLast ? this.currentLine + 1 : this.currentLine;
    for (let line = 0; line < alignLine; line++) {
      // 确保在对齐前删除行尾空格
      this.removeLineLastSpace(line);

      const lineList = charList.filter(item => item.line === line && item.charLeaf && !item.charLeaf.destroyed);
      if (lineList.length) {
        const lastChar = lineList[lineList.length - 1];
        const lastCharLeaf = lastChar.charLeaf;
        const lastPaddingRight = lastChar.paddingRight || 0;
        const remainWidth = this.width - lastCharLeaf.x - lastChar.width - lastPaddingRight;

        // 判断是否为自动换行的最后一行
        const isAutoWrapLastLine = line === this.currentLine && lastChar.text !== '\n';

        if (remainWidth > 0) {
          if (this.textAlign === 'center') {
            const offset = remainWidth / 2;
            lineList.forEach(char => {
              const charLeaf = char.charLeaf;
              charLeaf.x += offset;
            });
          } else if (this.textAlign === 'right') {
            const offset = remainWidth;
            lineList.forEach(char => {
              const charLeaf = char.charLeaf;
              charLeaf.x += offset;
            });
          } else if (this.textAlign === 'justify') {
            // 避免自动换行的最后一行也进行两端对齐
            if (lineList.length > 1 && lastChar.text !== '\n' && !isAutoWrapLastLine) {
              const gap = remainWidth / (lineList.length - 1);
              lineList.forEach((char, index) => {
                const charLeaf = char.charLeaf;
                charLeaf.x += index * gap;
              });
            }
          }
        }
      }
    }
  }

  // 创建注音
  createRt() {
    this.parseList.forEach(item => {
      const rt = item.rt;
      if (rt.text) {
        const rtLeaf = new Text({
          text: rt.text,
          fontFamily: this.rtFontFamily,
          fontSize: this.rtFontSize * this.fontScale,
          fontWeight: this.rtFontWeight,
          lineHeight: this.rtFontSize * this.rtLineHeight * this.fontScale,
          fill: this.rtColor,
          stroke: this.rtStrokeWidth ? this.color : null,
          strokeWidth: this.rtStrokeWidth,
          strokeAlign: 'center',
          letterSpacing: this.rtLetterSpacing,
        });
        const bounds = rtLeaf.textDrawData.bounds;
        rt.rtLeaf = rtLeaf;
        rt.originalWidth = bounds.width;
        rt.originalHeight = bounds.height;
        rt.width = bounds.width;
        rt.height = bounds.height;
        this.positionRt(item);
        this.group.add(rtLeaf);
      }
    });
    // 如果需要再次压缩
    if (this.needCompressTwice) {
      this.updateTextScale();
      this.compressRuby();
      this.alignRuby();
      this.parseList.forEach(item => {
        this.positionRt(item);
      });
    }
  }

  // 更新文本压缩
  updateTextScale() {
    this.currentX = 0;
    this.currentY = 0;
    this.currentLine = 0;

    let noBreakCharList = [];
    let noBreakTotalWidth = 0;

    this.newlineList.forEach((newline, newlineIndex) => {
      const lastNewline = newlineIndex === this.newlineList.length - 1;
      newline.forEach(item => {
        const ruby = item.ruby;
        const rt = item.rt;
        const charList = ruby.charList;
        charList.forEach(char => {
          const charLeaf = char.charLeaf;
          const paddingLeft = char.paddingLeft || 0;
          const paddingRight = char.paddingRight || 0;
          if (this.firstLineCompress && newlineIndex === 0) {
            // 首行压缩到一行
            if (this.useScaleXForCompress) {
              charLeaf.scaleX = this.firstLineTextScale;
              char.width = char.originalWidth * this.firstLineTextScale;
            } else {
              const newFontSize = this.fontSize * this.firstLineTextScale;
              charLeaf.fontSize = newFontSize;
              charLeaf.lineHeight = newFontSize * this.lineHeight;
              char.width = char.originalWidth * this.firstLineTextScale;
              char.height = char.originalHeight * this.firstLineTextScale;
            }
          } else if (!this.noCompressText.includes(char.text) && lastNewline) {
            // 只压缩最后一行
            if (this.useScaleXForCompress) {
              charLeaf.scaleX = this.textScale;
              char.width = char.originalWidth * this.textScale;
            } else {
              const newFontSize = this.fontSize * this.textScale;
              charLeaf.fontSize = newFontSize;
              charLeaf.lineHeight = newFontSize * this.lineHeight;
              char.width = char.originalWidth * this.textScale;
              char.height = char.originalHeight * this.textScale;
            }
          }

          // 应用行距缩放
          charLeaf.lineHeight = char.originalHeight * this.lineHeightScale;
          char.height = char.originalHeight * this.lineHeightScale;

          if (rt.text) {
            noBreakCharList.push(char);
            noBreakTotalWidth += char.width + paddingLeft + paddingRight;
          } else {
            const totalWidth = char.width + paddingLeft + paddingRight;
            if (this.width && char.text !== '\n' && this.currentX && this.currentX + totalWidth > this.width) {
              // 避头尾处理
              const shouldAvoidCurrentCharAtStart = this.avoidStartChars.includes(char.text);
              const prevChar = this.getPreviousChar(char);
              const shouldAvoidPrevCharAtEnd = prevChar && this.avoidEndChars.includes(prevChar.text);

              if (shouldAvoidCurrentCharAtStart || shouldAvoidPrevCharAtEnd) {
                // 如果当前字符不能在行首，或前一个字符不能在行尾
                // 需要把前一个字符也移到下一行
                if (prevChar && prevChar.charLeaf) {
                  // 移除前一个字符的位置，将其移到下一行
                  const prevTotalWidth = prevChar.width + (prevChar.paddingLeft || 0) + (prevChar.paddingRight || 0);
                  this.currentX -= prevTotalWidth;
                  prevChar.charLeaf.x = 0; // 临时设置，会在换行后重新定位
                  prevChar.line = -1; // 标记为待重新定位
                }
              }
              this.addRow();

              // 重新定位被移到下一行的前一个字符
              if ((shouldAvoidCurrentCharAtStart || shouldAvoidPrevCharAtEnd) && prevChar && prevChar.line === -1) {
                this.positionChar(prevChar);
              }
            }
            this.positionChar(char);
            if (char.text === '\n') {
              this.addRow();
            }
          }
        });

        if (noBreakCharList.length) {
          if (this.width && this.currentX + noBreakTotalWidth > this.width) {
            this.addRow();
          }
          noBreakCharList.forEach(char => {
            this.positionChar(char);
          });

          noBreakCharList = [];
          noBreakTotalWidth = 0;
        }
      });
    });
  }

  // 检查是否应该避免在此处换行（当前字符是否不能在行首）
  shouldAvoidLineBreak(char) {
    return this.avoidStartChars.includes(char.text);
  }

  // 获取前一个字符
  getPreviousChar(currentChar) {
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    const currentIndex = charList.indexOf(currentChar);
    return currentIndex > 0 ? charList[currentIndex - 1] : null;
  }

  // 更新文本大小
  updateFontSize() {
    this.textScale = 1;
    this.lineHeightScale = 1;
    const fontSize = this.isSmallSize ? this.smallFontSize : this.fontSize;
    const sizePercent = fontSize / this.fontSize;
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    charList.forEach(char => {
      const charLeaf = char.charLeaf;
      charLeaf.fontSize = fontSize * this.fontScale;
      charLeaf.lineHeight = fontSize * this.lineHeight * this.fontScale;
      char.originalWidth *= sizePercent;
      char.originalHeight *= sizePercent;
      char.width *= sizePercent;
      char.height *= sizePercent;
    });
    this.updateTextScale();
  }

  // 定位Char
  positionChar(char) {
    const paddingLeft = char.paddingLeft || 0;
    const paddingRight = char.paddingRight || 0;
    const charLeaf = char.charLeaf;
    charLeaf.x = this.currentX + paddingLeft;
    charLeaf.y = this.currentY;
    this.currentX += char.width + paddingLeft + paddingRight;
    char.line = this.currentLine;
  }

  // 添加行
  addRow() {
    this.removeLineLastSpace(this.currentLine);
    const fontSize = this.isSmallSize ? this.smallFontSize : this.fontSize;
    this.currentX = 0;
    this.currentY += fontSize * this.lineHeight * this.fontScale * this.lineHeightScale;
    this.currentLine++;
  }

  // 删除行尾空格
  removeLineLastSpace(line) {
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    const lineList = charList.filter(item => item.line === line && item.charLeaf && !item.charLeaf.destroyed);
    if (lineList.length) {
      const lastChar = lineList[lineList.length - 1];
      if (lastChar.text === ' ') {
        const lastCharLeaf = lastChar.charLeaf;
        const lastPaddingLeft = lastChar.paddingLeft || 0;
        const lastPaddingRight = lastChar.paddingRight || 0;
        this.currentX -= lastChar.width + lastPaddingLeft + lastPaddingRight;
        lastCharLeaf.destroy();
        lastChar.line = -1;
        // 递归继续删除行尾空格
        this.removeLineLastSpace(line);
      }
    }
  }

  // 定位rt
  positionRt(item) {
    const ruby = item.ruby;
    const rt = item.rt;
    const rtLeaf = rt.rtLeaf;
    if (rtLeaf) {
      const firstChar = ruby.charList[0];
      const lastChar = ruby.charList[ruby.charList.length - 1];
      const firstCharLeaf = firstChar.charLeaf;
      const lastCharLeaf = lastChar.charLeaf;
      const firstPaddingLeft = firstChar.paddingLeft || 0;
      const lastPaddingRight = lastChar.paddingRight || 0;
      const rubyWidth = lastCharLeaf.x - firstCharLeaf.x + lastChar.width + firstPaddingLeft + lastPaddingRight;
      const rubyFontSize = this.isSmallSize ? this.smallFontSize : this.fontSize;
      const rtTargetWidth = rubyWidth - Math.min(firstChar.width, lastChar.width, rubyFontSize) / 2;

      rtLeaf.around = { type: 'percent', x: 0.5, y: 0 };
      rtLeaf.x = firstCharLeaf.x + rubyWidth / 2 - firstPaddingLeft;
      rtLeaf.y = firstCharLeaf.y + this.rtTop * this.fontScale;

      if (this.rtFontScaleX !== 1) {
        // 特殊情况不做压缩，只居中对齐
        if (this.useScaleXForCompress) {
          rtLeaf.scaleX = this.rtFontScaleX;
        } else {
          const newFontSize = rtLeaf.fontSize * this.rtFontScaleX;
          rtLeaf.fontSize = newFontSize;
          rtLeaf.lineHeight = newFontSize * this.rtLineHeight;
        }
      } else if (rt.width < rtTargetWidth && ruby.text.length > 1) {
        // 拉伸两端对齐
        const maxLetterSpacing = this.rtFontSize * this.fontScale * 9;
        const newLetterSpacing = (rtTargetWidth - rt.width) / (rt.text.length - 1);
        rtLeaf.letterSpacing = Math.min(newLetterSpacing, maxLetterSpacing);
        rtLeaf.x += rtLeaf.letterSpacing / 2;
      } else if (rt.width > rubyWidth) {
        // 压缩
        if (rubyWidth / rt.width < 0.6) {
          // 防止过度压缩，加宽ruby
          // 公式：(rubyWidth + widen) / rtWidth = 0.6
          const widen = 0.6 * rt.width - rubyWidth;
          if (this.useScaleXForCompress) {
            rtLeaf.scaleX = 0.6;
          } else {
            const newFontSize = rtLeaf.fontSize * 0.6;
            rtLeaf.fontSize = newFontSize;
            rtLeaf.lineHeight = newFontSize * this.rtLineHeight;
          }
          firstChar.paddingLeft = widen / 2;
          lastChar.paddingRight = widen / 2;
          this.needCompressTwice = true;
        } else {
          const scaleRatio = rubyWidth / rt.width;
          if (this.useScaleXForCompress) {
            rtLeaf.scaleX = scaleRatio;
          } else {
            const newFontSize = rtLeaf.fontSize * scaleRatio;
            rtLeaf.fontSize = newFontSize;
            rtLeaf.lineHeight = newFontSize * this.rtLineHeight;
          }
        }
      }
    }
  }

  // 创建渐变
  createGradient() {
    if (this.gradient) {
      const fontSize = this.isSmallSize ? this.smallFontSize : this.fontSize;
      this.parseList.forEach(item => {
        const ruby = item.ruby;
        const charList = ruby.charList;
        charList.forEach(char => {
          const charLeaf = char.charLeaf;
          charLeaf.set({
            fill: {
              type: 'linear',
              from: 'top-left',
              to: 'bottom-right',
              stops: [
                { offset: 0, color: this.gradientColor1 },
                { offset: 0.4, color: this.gradientColor2 },
                { offset: 0.55, color: this.gradientColor2 },
                { offset: 0.6, color: this.gradientColor1 },
                { offset: 0.75, color: this.gradientColor2 },
              ],
            },
            stroke: 'rgba(0, 0, 0, 0.2)',
            strokeWidth: fontSize * 0.025 * this.fontScale,
            strokeAlign: 'outside',
            innerShadow: {
              blur: fontSize * 0.005 * this.fontScale,
              x: fontSize * 0.015 * this.fontScale,
              y: fontSize * 0.015 * this.fontScale,
              color: 'rgba(0, 0, 0, 0.3)',
            },
          });
        });
      });
    }
  }

  // 创建元素信息
  createBounds() {
    this.bounds = {
      width: 0,
      height: 0,
    };
    const charList = this.parseList.map(item => item.ruby.charList).flat();
    for (let line = 0; line < this.currentLine + 1; line++) {
      const lineList = charList.filter(item => item.line === line);
      if (lineList.length) {
        const lastChar = lineList[lineList.length - 1];
        const lastCharLeaf = lastChar.charLeaf;
        const lastPaddingRight = lastChar.paddingRight || 0;
        this.bounds.width = Math.max(this.bounds.width, lastCharLeaf.x + lastChar.width + lastPaddingRight) * this.scaleX;
        this.bounds.height = Math.max(this.bounds.height, lastCharLeaf.y + lastChar.height) * this.scaleY;
      }
    }
  }
}
