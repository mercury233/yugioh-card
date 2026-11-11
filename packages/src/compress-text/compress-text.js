/**
 * 压缩文本渲染模块。
 *
 * 该模块提供 CompressText 类，用于在 Leafer 场景中渲染带有 ruby 注音的文本，
 * 并在给定宽高约束下完成解析、换行、压缩、对齐、注音定位以及最终边界统计。
 *
 * 整体处理流程包括：
 * 1. 解析原始文本并拆分成 ruby/rt 结构。
 * 2. 按显式换行符分组构建布局输入。
 * 3. 创建正文与注音叶子并测量尺寸。
 * 4. 对超宽连续纯文本执行布局阶段的回退切段。
 * 5. 根据宽高限制执行首行压缩、正文横向压缩和自动缩小。
 * 6. 完成正文对齐、注音定位与最终边界统计。
 *
 * 其中，超长连续文本的处理属于布局阶段的回退逻辑，不会改变默认分词模块的基础语义。
 * 在浏览器环境中，模块还会在字体加载完成后自动重新执行一次排版，以确保测量结果准确。
 */
import { Group, Text } from 'leafer-unified';
import { isBrowser } from '../utils/index.js';
import { splitBreakWordWithBracket } from './split-break-word.js';

const rubyTokenPattern = /\[[^\[\]()\r\n]+\([^\[\]()\r\n]*\)]/;
const rubyRtPattern = /^\[([^\[\]()\r\n]+)\(([^\[\]()\r\n]*)\)]$/;
const baseLineHeight = 1.15; // 默认正文与注音行高倍率。
const noCompressText = '●①②③④⑤⑥⑦⑧⑨⑩'; // 不参与正文横向压缩的特殊字符集合。
const avoidStartChars = '.。;；:：,，、”」)）·× '; // 避免在行首的特殊字符集合。
const avoidEndChars = '“「(（●'; // 避免在行尾的特殊字符集合。
const compressTextScaleStep = 0.02; // 高度适配时横向压缩搜索的步长。
const autoFontScaleMin = 0.5; // 本轮字号比例高于此阈值时允许继续缩小。
const autoFontScaleStep = 0.05; // 自动缩小时本轮字号比例的递减步长。
const rtLetterSpacingMaxRate = 9; // 注音拉伸时最大字距相对本轮注音字号的倍率。
const rtCompressRate = 0.6; // 注音过宽时允许压缩到的最小横向比例。

export class CompressText extends Group {
  /**
   * 创建压缩文本渲染实例，并初始化默认配置、内部缓存和浏览器字体加载后的重排逻辑。
   *
   * @param {object} [data={}] 初始化配置，会与默认配置合并后写入实例。
   */
  constructor(data = {}) {
    super();
    this.parseList = []; // 解析后的文本列表
    this.newlineList = []; // 根据换行符分割的文本列表
    this.rubyList = [];
    this.charInfoMap = new Map();
    this.rubyLineMap = new Map();
    this.currentX = 0; // 当前行的x坐标
    this.currentY = 0; // 当前行的y坐标
    this.currentLine = 0; // 当前行数
    this.textScale = 1; // 文本缩放比例
    this.lineHeightScale = 1; // 行距缩放比例
    this.firstLineTextScale = 1; // 首行文本缩放比例
    this.group = null; // Leafer文本组
    this.needCompressTwice = false; // 是否需要二次压缩
    this.bounds = {}; // 宽高信息

    this.defaultData = {
      text: '',
      fontFamily: 'ygo-sc',
      fontSize: 24,
      fontWeight: 'normal',
      lineHeight: baseLineHeight,
      letterSpacing: 0,
      wordSpacing: 0,
      firstLineCompress: false,
      textAlign: 'justify',
      textJustifyLast: false,
      color: 'black',
      strokeWidth: 0,
      rtFontFamily: 'ygo-tip',
      rtFontSize: 13,
      rtFontWeight: 'bold',
      rtLineHeight: baseLineHeight,
      rtLetterSpacing: 0,
      rtTop: -9,
      rtColor: 'black',
      rtStrokeWidth: 0,
      rtFontScaleX: 1,
      fontScale: 1,
      minTextScale: 0.8,
      minLineHeightScale: 0.9,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      zIndex: 0,
    };

    this.initData(data);

    if (isBrowser) {
      this.fontSet = document.fonts;
      this.onFontsLoaded = () => {
        if (!this.destroyed) this.compressText();
      };
      // ready 可能在异步获取字体列表前就已完成，后续加载仍需重新测量，不能沿用回退字体的字宽。
      this.fontSet.addEventListener('loadingdone', this.onFontsLoaded);
      this.fontSet.ready.then(this.onFontsLoaded);
    }
  }

  destroy() {
    this.fontSet?.removeEventListener('loadingdone', this.onFontsLoaded);
    super.destroy();
  }

  /**
   * 批量更新实例配置。
   *
   * 仅当传入值与当前实例值不同的时候才会触发重新排版，避免无意义的重复计算。
   * 未提供的字段会回退到默认值语义，与现有 set 行为保持一致。
   *
   * @param {object} [data={}] 需要更新的配置项。
   */
  set(data = {}) {
    let needCompressText = false;
    Object.keys(data).forEach(key => {
      const value = data[key] ?? this.defaultData[key];
      if (!Object.is(this[key], value)) {
        this[key] = value;
        needCompressText = true;
      }
    });
    if (needCompressText) {
      this.compressText();
    }
  }

  /**
   * 使用默认配置初始化实例数据。
   *
   * 该方法会将默认配置与传入配置合并后交给 set，确保初始化和后续更新走同一条赋值逻辑。
   *
   * @param {object} [data={}] 初始化配置。
   */
  initData(data = {}) {
    this.set(Object.assign({}, this.defaultData, data));
  }

  // 解析与缓存

  /**
   * 解析原始文本，生成包含 ruby/rt 结构的列表。
   *
   * 先识别完整注音标记，再处理 bold 标签、显式换行符和 noCompressText，避免拆散注音中的特殊字符。
   * 正文通过 charList 保留分词片段，供逐词换行、禁则处理及整组注音定位使用；不合法的注音标记按普通文本处理。
   *
   * @returns {Array<{ruby: {text: string, bold: boolean, charList: object[]}, rt: object}>} 解析后的文本项列表。
   */
  getParseList() {
    let bold = false;
    return String(this.text).trimEnd().split(new RegExp(`(${rubyTokenPattern.source}|<b>|</b>|\n|[${noCompressText}])`)).filter(value => value).map(value => {
      let rubyText = value;
      let rtText = '';
      const rubyMatch = value.match(rubyRtPattern);
      if (rubyMatch) {
        rubyText = rubyMatch[1];
        rtText = rubyMatch[2];
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
          charList: splitBreakWordWithBracket(rubyText).map(char => ({ text: char })),
        },
        rt: {
          text: rtText,
        },
      };
    }).filter(value => value);
  }

  /**
   * 基于解析结果按显式换行符分组，生成内部的换行段列表。
   *
   * 这里的分组只处理用户输入中的 \n，不负责基于宽度的自动换行。
   * 宽度驱动的换行会在布局阶段由 updateTextScale 处理。
   *
   * @returns {Array<Array<{ruby: object, rt: object}>>} 按显式换行分组后的列表。
   */
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

  /**
   * 获取当前参与布局的字号。
   *
   * @returns {number} 当前布局字号。
   */
  getCurrentFontSize() {
    return this.fontSize * this.renderFontScale;
  }

  /**
   * 获取某个 ruby 项两侧额外补白的总宽度。
   *
   * 主要用于 rt 过宽时通过 paddingLeft/paddingRight 扩展 ruby 占位宽度的场景。
   *
   * @param {object} ruby ruby 布局对象。
   * @returns {number} 左右补白总和。
   */
  getPaddingWidth(ruby) {
    return (ruby.paddingLeft || 0) + (ruby.paddingRight || 0);
  }

  /**
   * 重置压缩阶段的临时状态。
   *
   * 每次完整重排前从 fontScale 恢复本轮字号比例，并重置横向压缩、行距、首行压缩和二次压缩标记。
   * 自动缩小只修改 renderFontScale，不改变用户配置的 fontScale。
   */
  resetCompressionState() {
    this.renderFontScale = this.fontScale;
    this.textScale = 1;
    this.lineHeightScale = 1;
    this.firstLineTextScale = 1;
    this.needCompressTwice = false;
  }

  /**
   * 重建解析缓存。
   *
   * 该方法会依次刷新 parseList、newlineList 和依赖它们的平铺缓存，
   * 是每次重新排版前的数据准备入口。
   */
  rebuildParseCache() {
    this.parseList = this.getParseList();
    this.newlineList = this.getNewlineList();
    this.updateLayoutCache();
  }

  /**
   * 重建承载文字叶子的 Leafer Group。
   *
   * 如果旧 group 已存在，则会先销毁旧实例，避免旧叶子残留在场景树中。
   */
  resetGroup() {
    if (this.group) {
      this.group.destroy();
    }
    this.group = new Group();
  }

  // 文本叶子创建与测量

  /**
   * 创建一个通用文本 item。
   *
   * 该结构同时支持正文与注音文本，供解析阶段和纯文本切段逻辑复用。
   *
   * @param {string} rubyText 正文文本。
   * @param {string} [rtText=''] 注音文本。
   * @param {boolean} [bold=false] 是否按粗体处理。
   * @returns {{ruby: {text: string, bold: boolean}, rt: {text: string}}} 通用文本 item。
   */
  createTextItem(rubyText, rtText = '', bold = false) {
    return {
      ruby: {
        text: rubyText,
        bold,
      },
      rt: {
        text: rtText,
      },
    };
  }

  /**
   * 创建一个不带注音的纯文本 item。
   *
   * 该方法是 createTextItem 的纯文本特化版本，主要供超宽回退切段时复用。
   *
   * @param {string} text 纯文本内容。
   * @param {boolean} [bold=false] 是否按粗体处理。
   * @returns {{ruby: {text: string, bold: boolean}, rt: {text: string}}} 纯文本 item。
   */
  createPlainTextItem(text, bold = false) {
    return this.createTextItem(text, '', bold);
  }

  /**
   * 将字符串按 Unicode 字符边界拆成字符数组。
   *
   * 使用 Array.from 可以避免 surrogate pair 被错误拆分，适合处理中日韩字符和扩展字符。
   *
   * @param {string} text 原始文本。
   * @returns {string[]} 字符数组。
   */
  getTextCharList(text) {
    return Array.from(text);
  }

  /**
   * 获取字符串按 Unicode 字符边界计算后的长度。
   *
   * @param {string} text 原始文本。
   * @returns {number} 字符数量。
   */
  getTextCharLength(text) {
    return this.getTextCharList(text).length;
  }

  /**
   * 创建并立即测量一个纯文本 item。
   *
   * 主要供超宽回退逻辑使用，生成 item 后立即附带 rubyLeaf、宽高等测量信息。
   *
   * @param {string} text 文本内容。
   * @param {boolean} [bold=false] 是否粗体。
   * @returns {{ruby: object, rt: {text: string}}} 已测量的纯文本 item。
   */
  createMeasuredPlainTextItem(text, bold = false) {
    const item = this.createPlainTextItem(text, bold);
    this.createRubyLeaf(item.ruby);
    return item;
  }

  /**
   * 销毁 ruby 对应的文本叶子。
   *
   * 用于超宽回退切段时清理临时测量叶子，避免多余节点残留。
   *
   * @param {object} ruby ruby 布局对象。
   */
  destroyRubyLeaf(ruby) {
    if (ruby?.rubyLeaf) {
      ruby.rubyLeaf.destroy();
    }
  }

  /**
   * 生成 ruby 正文 Text 叶子所需的样式配置。
   *
   * @param {object} ruby ruby 布局对象。
   * @returns {object} Leafer Text 配置。
   */
  getRubyTextStyle(ruby) {
    return {
      text: ruby.text,
      fontFamily: this.fontFamily,
      fontSize: this.getCurrentFontSize(),
      fontWeight: ruby.bold ? 'bold' : this.fontWeight,
      lineHeight: this.fontSize * this.lineHeight * this.renderFontScale,
      fill: this.color,
      stroke: this.strokeWidth ? this.color : null,
      strokeWidth: this.strokeWidth,
      strokeAlign: 'center',
      letterSpacing: this.letterSpacing * this.renderFontScale,
    };
  }

  /**
   * 生成注音 rt Text 叶子所需的样式配置。
   *
   * @param {object} rt rt 布局对象。
   * @returns {object} Leafer Text 配置。
   */
  getRtTextStyle(rt) {
    return {
      text: rt.text,
      fontFamily: this.rtFontFamily,
      fontSize: this.rtFontSize * this.renderFontScale,
      fontWeight: this.rtFontWeight,
      lineHeight: this.rtFontSize * this.rtLineHeight * this.renderFontScale,
      fill: this.rtColor,
      stroke: this.rtStrokeWidth ? this.color : null,
      strokeWidth: this.rtStrokeWidth,
      strokeAlign: 'center',
      letterSpacing: this.rtLetterSpacing,
    };
  }

  /**
   * 创建 ruby 正文叶子并把测量结果回写到 ruby 对象。
   *
   * 测量结果会作为后续换行、压缩、对齐和边界计算的基础数据。
   * 对于空格字符，会额外叠加 wordSpacing。
   *
   * @param {object} ruby ruby 布局对象。
   * @returns {Text} 创建出的 Leafer Text 实例。
   */
  createRubyLeaf(ruby) {
    const rubyLeaf = new Text(this.getRubyTextStyle(ruby));
    const bounds = rubyLeaf.textDrawData.bounds;
    const spacingWidth = ruby.text === ' ' ? this.wordSpacing : 0;

    ruby.rubyLeaf = rubyLeaf;
    ruby.originalWidth = bounds.width + spacingWidth;
    ruby.originalHeight = bounds.height;
    ruby.width = ruby.originalWidth;
    ruby.height = ruby.originalHeight;

    return rubyLeaf;
  }

  /**
   * 创建 rt 注音叶子并把测量结果回写到 rt 对象。
   *
   * @param {object} rt rt 布局对象。
   * @returns {Text} 创建出的 Leafer Text 实例。
   */
  createRtLeaf(rt) {
    const rtLeaf = new Text(this.getRtTextStyle(rt));
    const bounds = rtLeaf.textDrawData.bounds;

    rt.rtLeaf = rtLeaf;
    rt.originalWidth = bounds.width;
    rt.originalHeight = bounds.height;
    rt.width = bounds.width;
    rt.height = bounds.height;

    return rtLeaf;
  }

  /**
   * 在 rt 触发宽度压缩扩展后重新执行一次正文布局。
   *
   * 当 rt 太宽导致 ruby 被加宽时，需要重新计算正文换行、压缩和对齐，
   * 否则正文与注音的相对位置会失真。
   */
  relayoutAfterRtCompression() {
    this.updateTextScale();
    this.compressRuby();
    this.alignRuby();
    this.parseList.forEach(item => {
      this.positionRt(item);
    });
  }

  /**
   * 根据当前 parseList 重建平铺缓存。
   *
   * rubyList 保存各注音组内的正文分词片段，供统一测量与布局使用。
   * charInfoMap 记录片段所属项及前驱，供禁则处理移动整个注音组时查询。
   */
  updateLayoutCache() {
    this.rubyList = this.parseList.flatMap(item => item.ruby.charList);
    this.charInfoMap.clear();
    let previousChar;
    this.parseList.forEach(item => {
      item.ruby.charList.forEach(char => {
        this.charInfoMap.set(char, { previousChar, item });
        previousChar = char;
      });
    });
  }

  /**
   * 执行完整的文本压缩与渲染流程。
   *
   * 顺序包括：
   * 1. 重置压缩状态。
   * 2. 重建解析缓存。
   * 3. 重建承载 group。
   * 4. 创建正文叶子并处理超宽回退。
   * 5. 计算压缩、对齐、注音与边界。
   * 6. 将结果挂入当前 Group。
   */
  compressText() {
    this.resetCompressionState();
    this.rebuildParseCache();
    this.resetGroup();
    this.createRuby();
    this.compressRuby();
    this.alignRuby();
    this.createRt();
    this.createBounds();
    this.add(this.group);
  }

  /**
   * 创建正文 ruby 叶子并执行基于宽度的初步布局准备。
   *
   * 该阶段会先为解析结果中的 ruby 创建叶子，随后应用超宽回退切段，
   * 再将最终保留的 rubyLeaf 加入 group，并执行一次基础布局。
   */
  createRuby() {
    this.parseList.forEach(item => {
      item.ruby.charList.forEach(char => {
        char.bold = item.ruby.bold;
        this.createRubyLeaf(char);
      });
    });
    this.applyOverflowFallback();
    this.rubyList.forEach(ruby => {
      this.group.add(ruby.rubyLeaf);
    });
    this.updateTextScale();
  }

  // 超宽回退处理

  /**
   * 在给定起点上，通过二分查找找到当前容器宽度下可容纳的最大文本片段。
   *
   * 该方法会不断创建临时测量 item，保留最后一个能放下的候选项，
   * 是超长连续文本切段的核心测量逻辑。
   *
   * @param {string[]} textList 字符数组。
   * @param {number} start 当前片段起始索引。
   * @param {boolean} bold 是否粗体。
   * @returns {{ruby: object, rt: {text: string}}} 当前起点下最大可容纳的文本片段。
   */
  findLargestFittingTextSegment(textList, start, bold) {
    let low = start;
    let high = textList.length;
    let bestItem = null;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const nextItem = this.createMeasuredPlainTextItem(textList.slice(start, mid).join(''), bold);

      if (nextItem.ruby.width <= this.width) {
        this.destroyRubyLeaf(bestItem?.ruby);
        bestItem = nextItem;
        low = mid;
      } else {
        this.destroyRubyLeaf(nextItem.ruby);
        high = mid - 1;
      }
    }

    return bestItem ?? this.createMeasuredPlainTextItem(textList[start], bold);
  }

  /**
   * 将单个纯文本 item 按宽度切分成多个可容纳片段。
   *
    * 该方法仅在单个纯文本片段自身超宽时作为回退路径触发。
    *
   * 切分结果仍然保持 itemList 结构，便于直接复用现有布局流程。
   *
   * @param {{ruby: object, rt: object}} item 需要切分的纯文本项。
   * @returns {Array<Array<{ruby: object, rt: object}>>} 切分后的片段列表。
   */
  splitPlainTextItemIntoFittingSegments(item) {
    const textList = this.getTextCharList(item.ruby.text);
    const itemList = [];
    let start = 0;

    while (start < textList.length) {
      const bestItem = this.findLargestFittingTextSegment(textList, start, item.ruby.bold);

      itemList.push([bestItem]);
      start += this.getTextCharLength(bestItem.ruby.text);
    }

    return itemList;
  }

  /**
   * 对超宽纯文本执行布局阶段的回退切段。
   *
   * 带注音的项保持不可拆分。
   * 切段结果写回原项的 charList，并刷新平铺缓存，不改变显式换行分组与注音归属。
   */
  applyOverflowFallback() {
    if (!this.width) {
      return;
    }

    this.parseList.forEach(item => {
      if (item.rt.text) {
        return;
      }
      item.ruby.charList = item.ruby.charList.flatMap(ruby => {
        if (ruby.width <= this.width || Array.from(ruby.text).length <= 1) {
          return [ruby];
        }
        const segments = this.splitPlainTextItemIntoFittingSegments({ ruby, rt: item.rt });
        this.destroyRubyLeaf(ruby);
        return segments.flat().map(item => item.ruby);
      });
    });
    this.updateLayoutCache();
  }

  /**
   * 计算首行压缩时的最大可用缩放比例。
   *
   * 该方法只考虑显式换行分组中的第一段，返回恰好容纳一行的比例且不放大文字。
   *
   * @returns {number} 首行可用的压缩比例。
   */
  getFirstLineScale() {
    const firstNewlineRubyList = this.newlineList[0].flatMap(item => item.ruby.charList);
    let firstNewlineTotalWidth = 0;
    let maxWidth = this.width;

    firstNewlineRubyList.forEach(ruby => {
      firstNewlineTotalWidth += ruby.originalWidth;
      maxWidth -= this.getPaddingWidth(ruby);
    });

    if (!firstNewlineTotalWidth) {
      return 1;
    }

    return Math.min(maxWidth / firstNewlineTotalWidth, 1);
  }

  // 压缩与对齐

  /**
   * 根据当前宽高限制计算正文压缩比例。
   *
   * 先将首个显式换行段压缩到一行，再根据高度限制搜索正文横向缩放和整体行距。
   * 高度仍不足时逐步减小本轮字号比例，保留本地自动缩小策略。
   */
  compressRuby() {
    // 首行压缩
    if (this.firstLineCompress && this.width) {
      this.firstLineTextScale = this.getFirstLineScale();
      this.updateTextScale();
    }
    if (this.height) {
      this.optimizeTextToFitHeight();
    }
  }

  /**
   * 优化正文布局以适应高度限制。
   *
   * 每档正文横向比例只计算一次换行，再根据行数直接选择能容纳的最大整数行距；仍然放不下时缩小字号。
   * 注音扩宽后的二次排版也会进入搜索；若缩小到下限仍无解，保留默认横向与行距比例。
   */
  optimizeTextToFitHeight() {
    const lastChar = this.rubyList.at(-1);
    if (!lastChar) return;
    // 注音扩宽后的二次排版可能仍带有压缩比例，只有未压缩的布局才可直接跳过搜索。
    if (this.textScale === 1 && this.lineHeightScale === 1 && this.currentY + lastChar.height <= this.height) return;

    let bestTextScale = 1;
    let bestLineHeightScale = 1;
    let bestHeight = Number.MAX_VALUE;
    const baseLineHeight = this.getCurrentFontSize() * this.lineHeight;
    const maxLineHeight = Math.round(baseLineHeight);
    const minLineHeight = Math.round(baseLineHeight * this.minLineHeightScale);

    for (let step = 0; step <= Math.ceil((1 - this.minTextScale) / compressTextScaleStep); step++) {
      const textScale = Math.max(this.minTextScale, 1 - step * compressTextScaleStep);
      this.textScale = textScale;
      this.lineHeightScale = 1;
      this.updateTextScale();

      const lineCount = this.currentLine + 1;
      const lineHeight = Math.min(maxLineHeight, Math.floor(this.height / lineCount));
      if (lineHeight < minLineHeight) continue;
      const currentHeight = lineCount * lineHeight;
      if (Math.abs(currentHeight - this.height) < Math.abs(bestHeight - this.height)) {
        bestTextScale = textScale;
        bestLineHeightScale = Math.min(1, Math.max(this.minLineHeightScale, lineHeight / baseLineHeight));
        bestHeight = currentHeight;
      }
    }

    // 如果仍然无法适应，尝试减小本轮排版的字号比例
    if (bestHeight > this.height && this.renderFontScale > autoFontScaleMin) {
      this.renderFontScale -= autoFontScaleStep;
      this.updateFontSize();
      this.optimizeTextToFitHeight(); // 递归调用以重新优化
      return;
    }

    // 应用最佳的缩放比例
    // 若字号已不能继续缩小且搜索仍无解，两个最佳比例会有意保留初始值
    this.textScale = bestTextScale;
    this.lineHeightScale = bestLineHeightScale;
    this.updateTextScale();
  }

  /**
   * 获取当前需要参与对齐处理的行数。
   *
   * 当存在压缩、居中、右对齐或最后一行也需要 justify 时，需要把最后一行也纳入对齐。
   *
   * @returns {number} 需要对齐的行数。
   */
  getAlignLineCount() {
    return this.textScale < 1 || ['center', 'right'].includes(this.textAlign) || this.textJustifyLast ? this.currentLine + 1 : this.currentLine;
  }

  /**
   * 获取某一行在当前布局后的剩余可用宽度。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @returns {number} 当前行剩余宽度。
   */
  getLineRemainWidth(lineList) {
    const lastRuby = lineList[lineList.length - 1];
    const lastRubyLeaf = lastRuby.rubyLeaf;
    const lastPaddingRight = lastRuby.paddingRight || 0;

    return this.width - lastRubyLeaf.x - lastRuby.width - lastPaddingRight;
  }

  /**
   * 按给定偏移规则整体移动一行 ruby 的 x 坐标。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @param {(index: number) => number} offsetStep 根据索引返回偏移量的函数。
   */
  offsetRubyLine(lineList, offsetStep) {
    lineList.forEach((ruby, index) => {
      ruby.rubyLeaf.x += offsetStep(index);
    });
  }

  /**
   * 对单行 ruby 执行居中对齐。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @param {number} remainWidth 当前行剩余宽度。
   */
  alignCenterLine(lineList, remainWidth) {
    this.offsetRubyLine(lineList, () => remainWidth / 2);
  }

  /**
   * 对单行 ruby 执行右对齐。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @param {number} remainWidth 当前行剩余宽度。
   */
  alignRightLine(lineList, remainWidth) {
    this.offsetRubyLine(lineList, () => remainWidth);
  }

  /**
   * 对单行 ruby 执行两端对齐。
   *
   * 仅当当前行存在至少两个可参与分配的项且末尾不是显式换行符时才会生效。
   * 自动换行的最后一行默认不拉齐，开启 textJustifyLast 后才参与两端对齐。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @param {number} remainWidth 当前行剩余宽度。
   */
  alignJustifyLine(lineList, remainWidth) {
    if (lineList.length <= 1 || lineList[lineList.length - 1].text === '\n') {
      return;
    }

    if (!this.textJustifyLast && lineList === this.rubyLineMap.get(this.currentLine)) {
      return;
    }

    const gap = remainWidth / (lineList.length - 1);
    this.offsetRubyLine(lineList, index => index * gap);
  }

  /**
   * 根据当前 textAlign 对单行 ruby 应用对应的对齐逻辑。
   *
   * @param {object[]} lineList 当前行的 ruby 列表。
   * @param {number} remainWidth 当前行剩余宽度。
   */
  alignRubyLine(lineList, remainWidth) {
    if (this.textAlign === 'center') {
      this.alignCenterLine(lineList, remainWidth);
    } else if (this.textAlign === 'right') {
      this.alignRightLine(lineList, remainWidth);
    } else if (this.textAlign === 'justify') {
      this.alignJustifyLine(lineList, remainWidth);
    }
  }

  /**
   * 对所有需要处理的行执行正文对齐。
    *
    * 该方法会根据当前对齐模式遍历每一行，并在存在剩余宽度时应用对应的对齐策略。
   */
  alignRuby() {
    const alignLine = this.getAlignLineCount();
    for (let line = 0; line < alignLine; line++) {
      this.removeLineLastSpace(line);
      const lineList = this.rubyLineMap.get(line);
      if (!lineList?.length) {
        continue;
      }
      const remainWidth = this.getLineRemainWidth(lineList);
      if (remainWidth > 0) {
        this.alignRubyLine(lineList, remainWidth);
      }
    }
  }

  /**
   * 创建所有注音 rt 叶子并完成初始定位。
   *
   * 如果在 rt 压缩过程中触发了正文扩宽，会再执行一次正文重排以保持对齐正确。
   */
  createRt() {
    this.parseList.forEach(item => {
      const rt = item.rt;
      if (rt.text) {
        const rtLeaf = this.createRtLeaf(rt);
        this.positionRt(item);
        this.group.add(rtLeaf);
      }
    });
    // rt 扩宽正文占位后需要再做一次正文重排。
    if (this.needCompressTwice) {
      this.relayoutAfterRtCompression();
    }
  }

  /**
   * 更新单个 ruby 的横向缩放比例和当前宽度。
   *
   * @param {object} ruby ruby 布局对象。
   * @param {number} scale 横向缩放比例。
   */
  updateRubyScale(ruby, scale) {
    const rubyLeaf = ruby.rubyLeaf;
    rubyLeaf.scaleX = scale;
    ruby.width = ruby.originalWidth * scale;
  }

  // 布局流程

  /**
   * 重置布局过程中的游标状态。
   */
  resetLayoutPosition() {
    this.currentX = 0;
    this.currentY = 0;
    this.currentLine = 0;
  }

  /**
   * 根据当前缩放状态重新执行一次正文布局。
   *
   * 重置游标、行缓存和片段可见性后，按显式换行分组逐词排版。
   * 带注音的字符作为整组移动，普通文本保留本地的行首、行尾禁则；试排隐藏的空格可在下一轮恢复。
   */
  updateTextScale() {
    this.resetLayoutPosition();
    this.rubyLineMap.clear();
    // 每次试排都从未定位状态开始，行尾空格在下一轮仍可能回到行内。
    this.rubyList.forEach(char => {
      char.line = -1;
      char.rubyLeaf.visible = true;
    });

    let noBreakCharList = [];
    let noBreakTotalWidth = 0;
    const lineHeight = Math.round(this.getCurrentFontSize() * this.lineHeight * this.lineHeightScale);
    this.firstLineTextScale = this.width ? this.getFirstLineScale() : 1;
    // 首段能在压缩下限内独占一行时，只压到所需宽度；过长的正文段仍正常换行。
    const fitFirstParagraph = this.firstLineCompress || this.firstLineTextScale === 1 ||
      (this.newlineList.length > 1 && this.textScale < 1 && this.firstLineTextScale >= this.minTextScale);

    this.newlineList.forEach((newline, newlineIndex) => {
      newline.forEach(item => {
        const ruby = item.ruby;
        const rt = item.rt;
        const charList = ruby.charList;
        charList.forEach(char => {
          const paddingLeft = char.paddingLeft || 0;
          const paddingRight = char.paddingRight || 0;
          if (fitFirstParagraph && newlineIndex === 0) {
            // 首行压缩到一行
            this.updateRubyScale(char, this.firstLineTextScale);
          } else if (!noCompressText.includes(char.text)) {
            this.updateRubyScale(char, this.textScale);
          } else {
            this.updateRubyScale(char, 1);
          }

          // 末行占用高度与换行步长一致，避免相同整数行距因浮点高度得到不同适配结果。
          char.height = lineHeight;

          if (rt.text) {
            noBreakCharList.push(char);
            noBreakTotalWidth += char.width + paddingLeft + paddingRight;
          } else {
            const totalWidth = char.width + paddingLeft + paddingRight;
            if (this.width && char.text !== '\n' && this.currentX && this.currentX + totalWidth > this.width + 1e-8) {
              // 避头尾处理
              const shouldAvoidCurrentCharAtStart = avoidStartChars.includes(char.text);
              const prevChar = this.charInfoMap.get(char).previousChar;
              const shouldAvoidPrevCharAtEnd = prevChar && avoidEndChars.includes(prevChar.text);
              let moveChars = [];
              if ((shouldAvoidCurrentCharAtStart || shouldAvoidPrevCharAtEnd) && prevChar?.line === this.currentLine) {
                const prevItem = this.charInfoMap.get(prevChar).item;
                moveChars = prevItem.rt.text ? prevItem.ruby.charList : [prevChar];
                this.currentX = moveChars[0].rubyLeaf.x - (moveChars[0].paddingLeft || 0);
                const lineList = this.rubyLineMap.get(this.currentLine);
                lineList.splice(lineList.length - moveChars.length, moveChars.length);
                moveChars.forEach(movedChar => {
                  movedChar.line = -1;
                });
              }
              // 注音组占满当前行时，保留整组与标点溢出，避免拆组或制造空行。
              if (!moveChars.length || this.currentX > 0) {
                this.addLine();
              }
              moveChars.forEach(movedChar => this.positionRuby(movedChar));
            }
            this.positionRuby(char);
            if (char.text === '\n') {
              this.addLine();
            }
          }
        });

        if (noBreakCharList.length) {
          if (this.width && this.currentX && this.currentX + noBreakTotalWidth > this.width + 1e-8) {
            this.addLine();
          }
          noBreakCharList.forEach(char => {
            this.positionRuby(char);
          });

          noBreakCharList = [];
          noBreakTotalWidth = 0;
        }
      });
    });
  }

  /**
   * 在本轮字号比例变化后重新测量正文及已有注音。
   *
   * 正文测量保留字距和额外空格宽度，注音测量重置上一轮拉伸与压缩造成的状态。
   * 更新后立即重新布局，以确保新的字号、宽度和高度信息全部生效。
   */
  updateFontSize() {
    this.textScale = 1;
    this.lineHeightScale = 1;
    const fontSize = this.getCurrentFontSize();
    this.rubyList.forEach(ruby => {
      const rubyLeaf = ruby.rubyLeaf;
      rubyLeaf.set({ ...this.getRubyTextStyle(ruby), lineHeight: fontSize * this.lineHeight });
      const bounds = rubyLeaf.textDrawData.bounds;
      const spacingWidth = ruby.text === ' ' ? this.wordSpacing : 0;
      ruby.originalWidth = bounds.width + spacingWidth;
      ruby.originalHeight = bounds.height;
      ruby.width = ruby.originalWidth;
      ruby.height = ruby.originalHeight;
    });
    // 注音扩宽可能触发第二次缩小，已有注音也必须重新测量，不能沿用上一轮字号。
    this.parseList.forEach(item => {
      const rt = item.rt;
      if (rt.rtLeaf) {
        rt.rtLeaf.set({ ...this.getRtTextStyle(rt), scaleX: 1 });
        const bounds = rt.rtLeaf.textDrawData.bounds;
        rt.originalWidth = rt.width = bounds.width;
        rt.originalHeight = rt.height = bounds.height;
      }
    });
    this.updateTextScale();
  }

  /**
   * 定位单个 ruby 的坐标并更新当前行游标。
   *
   * @param {object} ruby ruby 布局对象。
   */
  positionRuby(ruby) {
    const paddingLeft = ruby.paddingLeft || 0;
    const paddingRight = ruby.paddingRight || 0;
    const rubyLeaf = ruby.rubyLeaf;
    rubyLeaf.x = this.currentX + paddingLeft;
    rubyLeaf.y = this.currentY;
    this.currentX += ruby.width + paddingLeft + paddingRight;
    ruby.line = this.currentLine;
    if (!this.rubyLineMap.has(this.currentLine)) {
      this.rubyLineMap.set(this.currentLine, []);
    }
    this.rubyLineMap.get(this.currentLine).push(ruby);
  }

  /**
   * 切换到下一行并更新行游标。
   *
   * 切行前会先清理上一行末尾多余空格。
   */
  addLine() {
    this.removeLineLastSpace(this.currentLine);
    const fontSize = this.getCurrentFontSize();
    this.currentX = 0;
    // 先取整行距再累加，避免小数行距在栅格化时周期性多出或少掉一个像素。
    this.currentY += Math.round(fontSize * this.lineHeight * this.lineHeightScale);
    this.currentLine++;
  }

  /**
   * 隐藏指定行尾部连续的空格项并从行缓存移除。
   *
   * 同步回退 currentX，但保留叶子实例，使下一轮试排时回到行内的空格能够恢复。
   *
   * @param {number} line 目标行号。
   */
  removeLineLastSpace(line) {
    const lineList = this.rubyLineMap.get(line);
    while (lineList?.length) {
      const lastChar = lineList[lineList.length - 1];
      if (lastChar.text !== ' ') break;
      const lastCharLeaf = lastChar.rubyLeaf;
      const lastPaddingLeft = lastChar.paddingLeft || 0;
      const lastPaddingRight = lastChar.paddingRight || 0;
      this.currentX -= lastChar.width + lastPaddingLeft + lastPaddingRight;
      // 试排尚未确定最终换行，不能销毁下一轮可能回到行内的空格。
      lastCharLeaf.visible = false;
      lastChar.line = -1;
      lineList.pop();
    }
  }

  // 注音布局

  /**
   * 获取注音布局所需的上下文信息。
   *
   * 正文可能包含多个分词片段，使用首尾片段的位置与补白计算整组宽度。
   *
   * @param {{ruby: object, rt: object}} item 包含 ruby 与 rt 的文本项。
   * @returns {{ruby: object, rt: object, rubyLeaf: Text, rtLeaf: Text, paddingLeft: number, paddingRight: number, rubyWidth: number, firstChar: object, lastChar: object}} 注音布局上下文。
   */
  getRtLayoutContext(item) {
    const ruby = item.ruby;
    const rt = item.rt;
    const firstChar = ruby.charList[0];
    const lastChar = ruby.charList[ruby.charList.length - 1];
    const rubyLeaf = firstChar?.rubyLeaf;
    const rtLeaf = rt.rtLeaf;
    const paddingLeft = firstChar?.paddingLeft || 0;
    const paddingRight = lastChar?.paddingRight || 0;
    const rubyWidth = rubyLeaf ? lastChar.rubyLeaf.x - rubyLeaf.x + lastChar.width + paddingLeft + paddingRight : 0;

    return {
      ruby,
      rt,
      rubyLeaf,
      rtLeaf,
      paddingLeft,
      paddingRight,
      rubyWidth,
      firstChar,
      lastChar,
    };
  }

  /**
   * 执行注音的基础定位。
   *
   * @param {{rubyLeaf: Text, rtLeaf: Text, paddingLeft: number, rubyWidth: number}} context 注音布局上下文。
   */
  positionRtBase(context) {
    const { rubyLeaf, rtLeaf, paddingLeft, rubyWidth } = context;

    rtLeaf.around = { type: 'percent', x: 0.5, y: 0 };
    rtLeaf.x = rubyLeaf.x + rubyWidth / 2 - paddingLeft;
    rtLeaf.y = rubyLeaf.y + this.rtTop * this.renderFontScale;
  }

  /**
   * 应用直接指定的注音横向缩放。
   *
   * @param {{rtLeaf: Text}} context 注音布局上下文。
   */
  applyRtScaleXOverride(context) {
    context.rtLeaf.scaleX = this.rtFontScaleX;
  }

  /**
   * 通过增加字距对注音执行拉伸。
   *
   * @param {{rt: object, rtLeaf: Text, rtTargetWidth: number}} context 注音布局上下文。
   */
  stretchRtLetterSpacing(context) {
    const { rt, rtLeaf, rtTargetWidth } = context;
    const maxLetterSpacing = this.rtFontSize * this.renderFontScale * rtLetterSpacingMaxRate;
    const newLetterSpacing = (rtTargetWidth - rt.width) / (rt.text.length - 1);

    rtLeaf.letterSpacing = Math.min(newLetterSpacing, maxLetterSpacing);
    rtLeaf.x += rtLeaf.letterSpacing / 2;
  }

  /**
   * 在注音宽于正文时执行压缩或扩宽正文占位。
   *
   * @param {{firstChar: object, lastChar: object, rt: object, rtLeaf: Text, rubyWidth: number}} context 注音布局上下文。
   */
  compressRtToRubyWidth(context) {
    const { firstChar, lastChar, rt, rtLeaf, rubyWidth } = context;

    if (rubyWidth / rt.width < rtCompressRate) {
      const widen = rtCompressRate * rt.width - rubyWidth;
      rtLeaf.scaleX = rtCompressRate;
      firstChar.paddingLeft = widen / 2;
      lastChar.paddingRight = widen / 2;
      this.needCompressTwice = true;
    } else {
      rtLeaf.scaleX = rubyWidth / rt.width;
    }
  }

  /**
   * 根据注音与正文宽度关系选择对应的宽度适配策略。
   *
   * @param {{ruby: object, rt: object, rtLeaf: Text, rubyWidth: number, firstChar: object, lastChar: object}} context 注音布局上下文。
   */
  applyRtWidthStrategy(context) {
    const { ruby, rt, firstChar, lastChar, rubyWidth } = context;
    const rubyFontSize = this.getCurrentFontSize();
    context.rtTargetWidth = rubyWidth - Math.min(firstChar.width, lastChar.width, rubyFontSize) / 2;

    if (this.rtFontScaleX !== 1) {
      this.applyRtScaleXOverride(context);
    } else if (rt.width < context.rtTargetWidth && ruby.text.length > 1) {
      this.stretchRtLetterSpacing(context);
    } else if (rt.width > context.rubyWidth) {
      this.compressRtToRubyWidth(context);
    }
  }

  /**
   * 定位并调整单个注音 rt。
   *
   * 该方法会根据 ruby 和 rt 的宽度关系选择：
   * 1. 直接使用指定 scaleX。
   * 2. 增加 letterSpacing 进行拉伸。
   * 3. 压缩 rt。
   * 4. 在必要时通过增加 ruby padding 触发二次正文重排。
   *
   * @param {{ruby: object, rt: object}} item 包含 ruby 与 rt 的文本项。
   */
  positionRt(item) {
    const context = this.getRtLayoutContext(item);

    if (!context.rtLeaf) {
      return;
    }

    this.positionRtBase(context);
    this.applyRtWidthStrategy(context);
  }

  // 边界统计

  /**
   * 根据当前行分组结果统计最终渲染边界。
   *
   * 结果会写入 this.bounds，供外部或后续逻辑读取。
   */
  createBounds() {
    this.bounds = {
      width: 0,
      height: 0,
    };
    this.rubyLineMap.forEach(lineList => {
      if (!lineList.length) {
        return;
      }
      const lastRuby = lineList[lineList.length - 1];
      const lastRubyLeaf = lastRuby.rubyLeaf;
      const lastPaddingRight = lastRuby.paddingRight || 0;
      this.bounds.width = Math.max(this.bounds.width, lastRubyLeaf.x + lastRuby.width + lastPaddingRight);
      this.bounds.height = Math.max(this.bounds.height, lastRubyLeaf.y + lastRuby.height);
    });
    this.bounds.width *= this.scaleX;
    this.bounds.height *= this.scaleY;
  }
}
