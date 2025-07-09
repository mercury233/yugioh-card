import { inheritProp } from '../../utils/index.js';

export default inheritProp({
  fontFamily: 'ygo-en, serif',
  name: {
    fontFamily: 'ygo-en-name, serif',
    top: 25,
    fontSize: 77,
    letterSpacing: 0.5,
  },
  spellTrap: {
    fontFamily: 'ygo-en-race, serif',
    top: 123,
    fontSize: 36,
    right: 70,
    letterSpacing: 0.5,
    icon: {
      marginTop: 5,
      marginLeft: 5,
    },
  },
  pendulumDescription: {
    top: 623,
    fontSize: 20,
    lineHeight: 1.02,
    height: 107,
  },
  effect: {
    fontFamily: 'ygo-en-race, serif',
    top: 742,
    fontSize: 27,
    letterSpacing: 0.5,
    lineHeight: 1.02,
  },
  description: {
    fontSize: 20,
    lineHeight: 1.02,
    smallFontSize: 17.5,
  },
});
