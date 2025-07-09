import { Card } from '../card/index.js';
import { Group, Image, Text } from '@leafer-ui/node';
import { CompressText } from '../compress-text/index.js';
import { numberToFull } from '../utils/index.js';
import scStyle from './style/sc-style.js';
import tcStyle from './style/tc-style.js';
import jpStyle from './style/jp-style.js';
import krStyle from './style/kr-style.js';
import enStyle from './style/en-style.js';
import astralStyle from './style/astral-style.js';
import custom1Style from './style/custom1-style.js';
import custom2Style from './style/custom2-style.js';
import { readFileSync } from 'node:fs';
import { imageSize } from 'image-size';

export class YugiohCard extends Card {
  cardLeaf = null;
  nameLeaf = null;
  attributeLeaf = null;
  levelLeaf = null;
  rankLeaf = null;
  spellTrapLeaf = null;
  imageLeaf = null;
  maskLeaf = null;
  pendulumLeaf = null;
  pendulumDescriptionLeaf = null;
  packageLeaf = null;
  linkArrowLeaf = null;
  effectLeaf = null;
  descriptionLeaf = null;
  atkDefLinkLeaf = null;
  passwordLeaf = null;
  copyrightLeaf = null;
  laserLeaf = null;
  rareLeaf = null;
  attributeRareLeaf = null;
  twentiethLeaf = null;
  cardWidth = 680;
  cardHeight = 986;
  imageAspectRatio = 1;

  data = {
    language: 'sc',
    font: '',
    name: '',
    color: '',
    align: 'left',
    gradient: false,
    gradientColor1: '#999999',
    gradientColor2: '#ffffff',
    type: 'monster',
    attribute: 'dark',
    icon: '',
    image: '',
    cardType: 'normal',
    pendulumType: 'normal-pendulum',
    level: 0,
    rank: 0,
    pendulumScale: 0,
    pendulumDescription: '',
    monsterType: '',
    atkBar: true,
    atk: 0,
    def: 0,
    arrowList: [],
    description: '',
    firstLineCompress: false,
    descriptionAlign: false,
    descriptionZoom: 1,
    descriptionWeight: 0,
    package: '',
    password: '',
    copyright: '',
    laser: '',
    rare: '',
    twentieth: false,
    radius: true,
    scale: 1,
  };

  constructor(data = {}) {
    super(data);

    this.initLeafer();
    this.setData(data.data);
  }

  draw() {
    this.drawCard();
    this.drawName();
    this.drawAttribute();
    this.drawLevel();
    this.drawRank();
    this.drawSpellTrap();
    this.drawImage();
    this.drawMask();
    this.drawPendulum();
    this.drawPendulumDescription();
    this.drawPackage();
    this.drawLinkArrow();
    this.drawEffect();
    this.drawDescription();
    this.drawAtkDefLink();
    this.drawPassword();
    this.drawCopyright();
    this.drawLaser();
    this.drawRare();
    this.drawAttributeRare();
    this.drawTwentieth();
    this.updateScale();
  }

  drawCard() {
    if (!this.cardLeaf) {
      this.cardLeaf = new Image();
      this.leafer.add(this.cardLeaf);
    }
    this.cardLeaf.set({
      url: this.cardUrl,
      cornerRadius: this.data.radius ? 12 : 0,
      zIndex: 0,
    });
  }

  drawName() {
    const { name } = this.style;

    if (!this.nameLeaf) {
      this.nameLeaf = new CompressText();
      this.leafer.add(this.nameLeaf);
    }
    this.nameLeaf.set({
      text: this.data.name,
      fontFamily: name.fontFamily,
      fontSize: name.fontSize,
      firstLineCompress: true,
      letterSpacing: name.letterSpacing || 0,
      wordSpacing: name.wordSpacing || 0,
      textAlign: this.data.align || 'left',
      color: this.data.color || this.autoNameColor,
      gradient: this.data.gradient,
      gradientColor1: this.data.gradientColor1,
      gradientColor2: this.data.gradientColor2,
      rtFontSize: name.rtFontSize,
      rtTop: name.rtTop,
      rtColor: this.autoNameColor,
      width: this.showAttribute ? 503 : 565,
      height: 97,
      x: 57,
      y: name.top,
      zIndex: 10,
    });
  }

  drawAttribute() {
    if (!this.attributeLeaf) {
      this.attributeLeaf = new Image();
      this.leafer.add(this.attributeLeaf);
    }
    this.attributeLeaf.set({
      url: this.attributeUrl,
      x: 568,
      y: 47,
      visible: this.showAttribute,
      zIndex: 10,
    });
  }

  drawLevel() {
    if (!this.levelLeaf) {
      this.levelLeaf = new Group();
      for (let i = 0; i < 13; i++) {
        const level = new Image();
        this.levelLeaf.add(level);
      }
      this.leafer.add(this.levelLeaf);
    }

    const levelUrl = `${this.baseImage}/level.png`;
    const levelWidth = 42.7;
    const right = this.data.level < 13 ? 72 : 50;
    this.levelLeaf.children.forEach((level, index) => {
      level.set({
        url: levelUrl,
        x: this.cardWidth - right - index * (levelWidth + 2),
        y: 120,
        around: { type: 'percent', x: 1, y: 0 },
        visible: index < this.data.level,
      });
    });

    this.levelLeaf.set({
      visible: this.showLevel,
      zIndex: 10,
    });
  }

  drawRank() {
    if (!this.rankLeaf) {
      this.rankLeaf = new Group();
      for (let i = 0; i < 13; i++) {
        const rank = new Image();
        this.rankLeaf.add(rank);
      }
      this.leafer.add(this.rankLeaf);
    }

    const rankUrl = `${this.baseImage}/rank.png`;
    const rankWidth = 42.7;
    const left = this.data.rank < 13 ? 73 : 51;
    this.rankLeaf.children.forEach((rank, index) => {
      rank.set({
        url: rankUrl,
        x: left + index * (rankWidth + 2),
        y: 120,
        visible: index < this.data.rank,
      });
    });

    this.rankLeaf.set({
      visible: this.showRank,
      zIndex: 10,
    });
  }

  drawSpellTrap() {
    if (!this.spellTrapLeaf) {
      this.spellTrapLeaf = new Group();

      const rightText = new CompressText();
      const spellTrapIcon = new Image();
      const leftText = new CompressText();

      this.spellTrapLeaf.add(rightText);
      this.spellTrapLeaf.add(spellTrapIcon);
      this.spellTrapLeaf.add(leftText);

      this.leafer.add(this.spellTrapLeaf);
    }

    const { spellTrap } = this.style;
    const { icon } = spellTrap;

    const iconUrl = this.data.icon ? `${this.baseImage}/icon-${this.data.icon}.png` : '';
    const iconWidth = this.data.icon ? 35 : 0;
    const leftBracket = ['en', 'kr'].includes(this.data.language) ? '[' : '【';
    const rightBracket = ['en', 'kr'].includes(this.data.language) ? ']' : '】';
    const letterSpacing = spellTrap.letterSpacing || 0;
    const wordSpacing = spellTrap.wordSpacing || 0;

    const rightText = this.spellTrapLeaf.children[0];
    const spellTrapIcon = this.spellTrapLeaf.children[1];
    const leftText = this.spellTrapLeaf.children[2];

    rightText.set({
      text: rightBracket,
      fontFamily: spellTrap.fontFamily,
      fontSize: spellTrap.fontSize,
      letterSpacing,
      wordSpacing,
      scaleY: spellTrap.scaleY || 1,
      y: spellTrap.top,
    });
    const rightBounds = rightText.bounds;
    rightText.x = this.cardWidth - spellTrap.right - rightBounds.width;

    spellTrapIcon.set({
      url: iconUrl,
      x: rightText.x - (this.data.icon ? (icon.marginRight || 0) : 0) - iconWidth,
      y: spellTrap.top + (icon.marginTop || 0),
      width: iconWidth,
    });

    leftText.set({
      text: leftBracket + this.spellTrapName,
      fontFamily: spellTrap.fontFamily,
      fontSize: spellTrap.fontSize,
      letterSpacing,
      wordSpacing,
      scaleY: spellTrap.scaleY || 1,
      rtFontSize: spellTrap.rtFontSize,
      rtTop: spellTrap.rtTop,
      rtFontScaleX: spellTrap.rtFontScaleX || 1,
      y: spellTrap.top,
    });
    const leftBounds = leftText.bounds;
    leftText.x = spellTrapIcon.x - (this.data.icon ? (icon.marginLeft || 0) : 0) - leftBounds.width;

    this.spellTrapLeaf.set({
      visible: ['spell', 'trap'].includes(this.data.type),
      zIndex: 10,
    });
  }

  drawImage() {
    if (!this.imageLeaf) {
      this.imageLeaf = new Image();
      this.listenImageStatus(this.imageLeaf);
      this.leafer.add(this.imageLeaf);
    }

    if (this.data.image && this.data.type === 'pendulum') {
      try {
        const buffer = readFileSync(this.data.image);
        const dimensions = imageSize(buffer);
        this.imageAspectRatio = dimensions.width / dimensions.height;
      } catch (e) {
        this.imageAspectRatio = 1;
      }
    }

    this.imageLeaf.set({
      url: this.data.image,
      width: this.data.type === 'pendulum' ? 585 : 512,
      height: this.data.type === 'pendulum' ? (this.imageAspectRatio > 1 ? 438 : 749) : 512,
      x: this.data.type === 'pendulum' ? 48 : 85,
      y: this.data.type === 'pendulum' ? 177 : 182,
      visible: this.data.image,
      zIndex: 10,
    });
  }

  drawMask() {
    if (!this.maskLeaf) {
      this.maskLeaf = new Image();
      this.leafer.add(this.maskLeaf);
    }

    const maskUrl = this.data.type === 'pendulum' ? `${this.baseImage}/card-mask-pendulum.png` : `${this.baseImage}/card-mask.png`;
    this.maskLeaf.set({
      url: maskUrl,
      x: this.data.type === 'pendulum' ? 35 : 59,
      y: this.data.type === 'pendulum' ? 166 : 156,
      zIndex: 20,
    });
  }

  drawPendulum() {
    if (!this.pendulumLeaf) {
      this.pendulumLeaf = new Group();
      const leftPendulum = new Text();
      const rightPendulum = new Text();
      this.pendulumLeaf.add(leftPendulum);
      this.pendulumLeaf.add(rightPendulum);
      this.leafer.add(this.pendulumLeaf);
    }

    const leftPendulum = this.pendulumLeaf.children[0];
    const rightPendulum = this.pendulumLeaf.children[1];

    let left = 72;
    leftPendulum.set({
      text: this.data.pendulumScale,
      fontFamily: 'ygo-atk-def, serif',
      fontSize: 48,
      fill: 'black',
      letterSpacing: -5,
      x: left,
      y: 666,
      around: { type: 'percent', x: 0.5, y: 0 },
    });

    left = 608;
    rightPendulum.set({
      text: this.data.pendulumScale,
      fontFamily: 'ygo-atk-def, serif',
      fontSize: 48,
      fill: 'black',
      letterSpacing: -5,
      x: left,
      y: 666,
      around: { type: 'percent', x: 0.5, y: 0 },
    });

    this.pendulumLeaf.set({
      visible: this.data.type === 'pendulum',
      zIndex: 30,
    });
  }

  drawPendulumDescription() {
    if (!this.pendulumDescriptionLeaf) {
      this.pendulumDescriptionLeaf = new CompressText();
      this.leafer.add(this.pendulumDescriptionLeaf);
    }

    const { pendulumDescription } = this.style;

    this.pendulumDescriptionLeaf.set({
      text: this.data.pendulumDescription,
      fontFamily: pendulumDescription.fontFamily,
      fontSize: pendulumDescription.fontSize,
      fontScale: this.data.descriptionZoom,
      strokeWidth: this.data.descriptionWeight,
      lineHeight: pendulumDescription.lineHeight,
      letterSpacing: pendulumDescription.letterSpacing || 0,
      wordSpacing: pendulumDescription.wordSpacing || 0,
      rtFontSize: pendulumDescription.rtFontSize,
      rtTop: pendulumDescription.rtTop,
      width: 462,
      height: pendulumDescription.height || 105,
      x: 109,
      y: pendulumDescription.top,
      visible: this.data.type === 'pendulum',
      zIndex: 30,
    });
  }

  drawPackage() {
    if (!this.packageLeaf) {
      this.packageLeaf = new CompressText();
      this.leafer.add(this.packageLeaf);
    }

    this.packageLeaf.set({
      text: this.data.package,
      fontFamily: 'ygo-password, serif',
      fontSize: 20,
      color: this.data.type === 'monster' && this.data.cardType === 'xyz' ? 'white' : 'black',
      textAlign: this.data.type === 'pendulum' ? 'left' : 'right',
      y: this.data.type === 'pendulum' ? 903 : 707,
      zIndex: 30,
    });
    if (this.data.type === 'pendulum') {
      this.packageLeaf.x = 56;
    } else {
      const bounds = this.packageLeaf.bounds;
      const right = this.data.type === 'monster' && this.data.cardType === 'link' ? 121 : 71;
      this.packageLeaf.x = this.cardWidth - right - bounds.width;
    }
  }

  drawLinkArrow() {
    if (!this.linkArrowLeaf) {
      this.linkArrowLeaf = new Group();
      for (let i = 0; i < 8; i++) {
        const arrow = new Image();
        this.linkArrowLeaf.add(arrow);
      }
      this.leafer.add(this.linkArrowLeaf);
    }

    const arrowOnList = [
      { x: 272, y: 134, url: this.baseImage + '/arrow-up-on.png' },
      { x: 552, y: 145, url: this.baseImage + '/arrow-right-up-on.png' },
      { x: 596, y: 370, url: this.baseImage + '/arrow-right-on.png' },
      { x: 552, y: 649, url: this.baseImage + '/arrow-right-down-on.png' },
      { x: 272, y: 693, url: this.baseImage + '/arrow-down-on.png' },
      { x: 48, y: 649, url: this.baseImage + '/arrow-left-down-on.png' },
      { x: 37, y: 368, url: this.baseImage + '/arrow-left-on.png' },
      { x: 48, y: 145, url: this.baseImage + '/arrow-left-up-on.png' },
    ];

    const arrowOffList = [
      { x: 272, y: 134, url: this.baseImage + '/arrow-up-off.png' },
      { x: 552, y: 145, url: this.baseImage + '/arrow-right-up-off.png' },
      { x: 596, y: 370, url: this.baseImage + '/arrow-right-off.png' },
      { x: 552, y: 649, url: this.baseImage + '/arrow-right-down-off.png' },
      { x: 272, y: 693, url: this.baseImage + '/arrow-down-off.png' },
      { x: 48, y: 649, url: this.baseImage + '/arrow-left-down-off.png' },
      { x: 37, y: 368, url: this.baseImage + '/arrow-left-off.png' },
      { x: 48, y: 145, url: this.baseImage + '/arrow-left-up-off.png' },
    ];

    this.linkArrowLeaf.children.forEach((arrow, index) => {
      const showArrow = this.data.arrowList.includes(index + 1);
      arrow.set({
        url: showArrow ? arrowOnList[index].url : arrowOffList[index].url,
        x: showArrow ? arrowOnList[index].x : arrowOffList[index].x,
        y: showArrow ? arrowOnList[index].y : arrowOffList[index].y,
      });
    });

    this.linkArrowLeaf.set({
      visible: this.data.type === 'monster' && this.data.cardType === 'link',
      zIndex: 120,
    });
  }

  drawEffect() {
    if (!this.effectLeaf) {
      this.effectLeaf = new CompressText();
      this.leafer.add(this.effectLeaf);
    }

    const { effect } = this.style;

    const leftBracket = ['en', 'kr'].includes(this.data.language) ? '[' : '【';
    const rightBracket = ['en', 'kr'].includes(this.data.language) ? ']' : '】';

    this.effectLeaf.set({
      text: leftBracket + this.data.monsterType + rightBracket,
      fontFamily: effect.fontFamily,
      fontSize: effect.fontSize,
      strokeWidth: this.data.descriptionWeight,
      lineHeight: effect.lineHeight,
      letterSpacing: effect.letterSpacing || 0,
      wordSpacing: effect.wordSpacing || 0,
      rtFontSize: effect.rtFontSize,
      rtTop: effect.rtTop,
      width: 571,
      height: 100,
      x: 56 + (effect.textIndent || 0),
      y: effect.top,
      visible: this.showEffect,
      zIndex: 30,
    });
  }

  drawDescription() {
    if (!this.descriptionLeaf) {
      this.descriptionLeaf = new CompressText();
      this.leafer.add(this.descriptionLeaf);
    }

    const { effect, description } = this.style;

    let effectHeight = effect.minHeight || 0;
    if (this.showEffect) {
      effectHeight = effect.fontSize * effect.lineHeight;
    }

    let fontFamily = description.fontFamily;
    if (this.data.language === 'en' && !this.data.font &&
      ((this.data.type === 'monster' && this.data.cardType === 'normal') || (this.data.type === 'pendulum' && this.data.pendulumType === 'normal-pendulum'))) {
      fontFamily = 'ygo-en-italic';
    }

    let height = 180;
    if (!['spell', 'trap'].includes(this.data.type)) {
      if (this.showEffect) {
        height -= effectHeight;
      }
      if (this.data.atkBar) {
        height -= 27;
      }
    }

    this.descriptionLeaf.set({
      text: this.data.description,
      fontFamily,
      fontSize: description.fontSize,
      fontScale: this.data.descriptionZoom,
      textAlign: this.data.descriptionAlign ? 'center' : 'justify',
      firstLineCompress: this.data.firstLineCompress,
      strokeWidth: this.data.descriptionWeight,
      lineHeight: description.lineHeight,
      letterSpacing: description.letterSpacing || 0,
      wordSpacing: description.wordSpacing || 0,
      rtFontSize: description.rtFontSize,
      rtTop: description.rtTop,
      autoSmallSize: !!description.smallFontSize,
      smallFontSize: description.smallFontSize,
      width: 571,
      height,
      x: 55,
      y: effect.top + effectHeight,
      zIndex: 30,
    });
  }

  drawAtkDefLink() {
    if (!this.atkDefLinkLeaf) {
      this.atkDefLinkLeaf = new Group();
      const atkDefLinkImage = new Image();
      const atk = new Text();
      const def = new Text();
      const link = new Text();

      this.atkDefLinkLeaf.add(atkDefLinkImage);
      this.atkDefLinkLeaf.add(atk);
      this.atkDefLinkLeaf.add(def);
      this.atkDefLinkLeaf.add(link);

      this.leafer.add(this.atkDefLinkLeaf);
    }

    const atkDefLinkImage = this.atkDefLinkLeaf.children[0];
    const atk = this.atkDefLinkLeaf.children[1];
    const def = this.atkDefLinkLeaf.children[2];
    const link = this.atkDefLinkLeaf.children[3];
    atkDefLinkImage.set({
      url: this.atkDefLinkUrl,
      scale: 0.4857685,
      x: 55,
      y: 896,
    });

    let atkText = '';
    if (this.data.atk >= 0) {
      atkText = this.data.atk;
    } else if (this.data.atk === -1) {
      atkText = '?';
    } else if (this.data.atk === -2) {
      atkText = '∞';
    }
    atk.set({
      text: atkText,
      fontFamily: 'ygo-atk-def, serif',
      fontSize: 29.5,
      fill: 'black',
      letterSpacing: 1,
      x: 488,
      y: 894,
      around: { type: 'percent', x: 1, y: 0 },
      visible: ['monster', 'pendulum'].includes(this.data.type),
    });

    let defText = '';
    if (this.data.def >= 0) {
      defText = this.data.def;
    } else if (this.data.def === -1) {
      defText = '?';
    } else if (this.data.def === -2) {
      defText = '∞';
    }
    def.set({
      text: defText,
      fontFamily: 'ygo-atk-def, serif',
      fontSize: 29.5,
      fill: 'black',
      letterSpacing: 1,
      x: 625,
      y: 894,
      around: { type: 'percent', x: 1, y: 0 },
      visible: (this.data.type === 'monster' && this.data.cardType !== 'link') || this.data.type === 'pendulum',
    });

    const linkText = this.data.arrowList.length;
    const linkLeft = 624;
    link.set({
      text: linkText,
      fontFamily: 'ygo-link, serif',
      fontSize: 22,
      fill: 'black',
      letterSpacing: 1,
      x: linkLeft,
      y: 901,
      around: { type: 'percent', x: 1, y: 0 },
      scaleX: 1.3,
      visible: this.data.type === 'monster' && this.data.cardType === 'link',
    });

    this.atkDefLinkLeaf.set({
      visible: this.showAtkDefLink,
      zIndex: 30,
    });
  }

  drawPassword() {
    if (!this.passwordLeaf) {
      this.passwordLeaf = new CompressText();
      this.leafer.add(this.passwordLeaf);
    }

    this.passwordLeaf.set({
      text: this.data.password,
      fontFamily: 'ygo-password, serif',
      fontSize: 20,
      color: this.data.type === 'monster' && this.data.cardType === 'xyz' ? 'white' : 'black',
      x: 34,
      y: 937,
      zIndex: 30,
    });
  }

  drawCopyright() {
    if (!this.copyrightLeaf) {
      this.copyrightLeaf = new Image();
      this.leafer.add(this.copyrightLeaf);
    }

    const color = this.data.type === 'monster' && this.data.cardType === 'xyz' ? 'white' : 'black';
    const copyrightUrl = this.data.copyright ? `${this.baseImage}/copyright-${this.data.copyright}-${color}.svg` : '';
    this.copyrightLeaf.set({
      url: copyrightUrl,
      x: this.cardWidth - 70,
      y: 940,
      height: this.data.copyright ? null : 0,
      around: { type: 'percent', x: 1, y: 0 },
      visible: this.data.copyright,
      zIndex: 30,
    });
  }

  drawLaser() {
    if (!this.laserLeaf) {
      this.laserLeaf = new Image();
      this.leafer.add(this.laserLeaf);
    }

    const laserUrl = this.data.laser ? `${this.baseImage}/${this.data.laser}.png` : '';
    this.laserLeaf.set({
      url: laserUrl,
      x: 622,
      y: 929,
      width: this.data.laser ? null : 0,
      height: this.data.laser ? null : 0,
      visible: this.data.laser,
      zIndex: 120,
    });
  }

  drawRare() {
    if (!this.rareLeaf) {
      this.rareLeaf = new Image();
      this.leafer.add(this.rareLeaf);
    }

    const suffix = this.data.type === 'pendulum' ? '-pendulum' : '';
    const rareUrl = this.data.rare ? `${this.baseImage}/rare-${this.data.rare}${suffix}.png` : '';

    this.rareLeaf.set({
      url: rareUrl,
      cornerRadius: this.data.radius ? 12 : 0,
      visible: this.data.rare,
      zIndex: 100,
    });
  }

  drawAttributeRare() {
    if (!this.attributeRareLeaf) {
      this.attributeRareLeaf = new Image();
      this.leafer.add(this.attributeRareLeaf);
    }

    const attributeRareUrl = `${this.baseImage}/attribute-rare.png`;
    this.attributeRareLeaf.set({
      url: attributeRareUrl,
      x: 567,
      y: 47,
      visible: this.showAttributeRare,
      zIndex: 30,
    });
  }

  drawTwentieth() {
    if (!this.twentiethLeaf) {
      this.twentiethLeaf = new Image();
      this.leafer.add(this.twentiethLeaf);
    }

    const twentiethUrl = `${this.baseImage}/twentieth.png`;
    this.twentiethLeaf.set({
      url: twentiethUrl,
      x: 231,
      y: 744,
      visible: this.data.twentieth,
      zIndex: 10,
    });
  }

  get baseImage() {
    return `${this.resourcePath}/yugioh/image`;
  }

  get style() {
    let style = {};
    if (this.data.font) {
      if (this.data.font === 'custom1') {
        style = custom1Style;
      } else if (this.data.font === 'custom2') {
        style = custom2Style;
      }
    } else {
      if (this.data.language === 'sc') {
        style = scStyle;
      } else if (this.data.language === 'tc') {
        style = tcStyle;
      } else if (this.data.language === 'jp') {
        style = jpStyle;
      } else if (this.data.language === 'kr') {
        style = krStyle;
      } else if (this.data.language === 'en') {
        style = enStyle;
      } else if (this.data.language === 'astral') {
        style = astralStyle;
      } else if (this.data.language === 'astral') {
        style = astralStyle;
      }
    }
    return style;
  }

  get cardUrl() {
    if (this.data.type === 'monster') {
      return `${this.baseImage}/card-${this.data.cardType}.png`;
    } else if (this.data.type === 'pendulum') {
      return `${this.baseImage}/card-${this.data.pendulumType}.png`;
    } else {
      return `${this.baseImage}/card-${this.data.type}.png`;
    }
  }

  get autoNameColor() {
    let color = 'black';
    // 自动颜色
    if ((this.data.type === 'monster' && ['xyz', 'link'].includes(this.data.cardType)) || ['spell', 'trap'].includes(this.data.type) ||
      (this.data.type === 'pendulum' && ['xyz-pendulum', 'link-pendulum'].includes(this.data.pendulumType))) {
      color = 'white';
    }
    return color;
  }

  get showAttribute() {
    if (['monster', 'pendulum'].includes(this.data.type)) {
      return !!this.data.attribute;
    }
    return true;
  }

  get attributeUrl() {
    let suffix = '';
    if (this.data.language === 'jp') {
      suffix = '-jp';
    } else if (this.data.language === 'kr') {
      suffix = '-kr';
    } else if (this.data.language === 'en') {
      suffix = '-en';
    } else if (this.data.language === 'astral') {
      suffix = '-astral';
    }
    if (['monster', 'pendulum'].includes(this.data.type)) {
      if (!this.data.attribute) {
        return '';
      }
      return `${this.baseImage}/attribute-${this.data.attribute}${suffix}.png`;
    } else {
      return `${this.baseImage}/attribute-${this.data.type}${suffix}.png`;
    }
  }

  get spellTrapName() {
    let name = '';
    if (this.data.language === 'sc') {
      if (this.data.type === 'spell') {
        name = '魔法卡';
      } else if (this.data.type === 'trap') {
        name = '陷阱卡';
      }
    } else if (this.data.language === 'tc') {
      if (this.data.type === 'spell') {
        name = '魔法卡';
      } else if (this.data.type === 'trap') {
        name = '陷阱卡';
      }
    } else if (this.data.language === 'jp') {
      if (this.data.type === 'spell') {
        name = '[魔(ま)][法(ほう)]カード';
      } else if (this.data.type === 'trap') {
        name = '[罠(トラップ)]カード';
      }
    } else if (this.data.language === 'kr') {
      if (this.data.type === 'spell') {
        name = '마법 카드';
      } else if (this.data.type === 'trap') {
        name = '함정 카드';
      }
    } else if (this.data.language === 'en') {
      if (this.data.type === 'spell') {
        name = 'Spell Card';
      } else if (this.data.type === 'trap') {
        name = 'Trap Card';
      }
    } else if (this.data.language === 'astral') {
      if (this.data.type === 'spell') {
        name = 'マホウカアド';
      } else if (this.data.type === 'trap') {
        name = 'トラププカアド';
      }
    }
    return name;
  }

  get showAttributeRare() {
    return this.showAttribute && ['hr', 'ser', 'gser', 'pser'].includes(this.data.rare);
  }

  get showLevel() {
    let show = false;
    if (this.data.type === 'monster') {
      show = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'token'].includes(this.data.cardType);
    } else if (this.data.type === 'pendulum') {
      show = ['normal-pendulum', 'effect-pendulum', 'ritual-pendulum', 'fusion-pendulum', 'synchro-pendulum'].includes(this.data.pendulumType);
    }
    return show;
  }

  get showRank() {
    let show = false;
    if (this.data.type === 'monster') {
      show = this.data.cardType === 'xyz';
    } else if (this.data.type === 'pendulum') {
      show = this.data.pendulumType === 'xyz-pendulum';
    }
    return show;
  }

  get showEffect() {
    return ['monster', 'pendulum'].includes(this.data.type) && this.data.monsterType;
  }

  get showAtkDefLink() {
    if (!this.data.atkBar) {
      return false;
    } else if (this.data.language === 'astral') {
      if ((this.data.type === 'monster' && this.data.cardType !== 'link') || this.data.type === 'pendulum') {
        return true;
      }
      if (this.data.type === 'monster' && this.data.cardType === 'link') {
        return true;
      }
    } else {
      if ((this.data.type === 'monster' && this.data.cardType !== 'link') || this.data.type === 'pendulum') {
        return true;
      }
      if (this.data.type === 'monster' && this.data.cardType === 'link') {
        return true;
      }
    }
    return false;
  }

  get atkDefLinkUrl() {
    let url = '';
    if (this.data.language === 'astral') {
      if ((this.data.type === 'monster' && this.data.cardType !== 'link') || this.data.type === 'pendulum') {
        url = `${this.baseImage}/atk-def-astral.svg`;
      }
      if (this.data.type === 'monster' && this.data.cardType === 'link') {
        url = `${this.baseImage}/atk-link-astral.svg`;
      }
    } else {
      if ((this.data.type === 'monster' && this.data.cardType !== 'link') || this.data.type === 'pendulum') {
        url = `${this.baseImage}/atk-def.svg`;
      }
      if (this.data.type === 'monster' && this.data.cardType === 'link') {
        url = `${this.baseImage}/atk-link.svg`;
      }
    }
    return url;
  }
}
