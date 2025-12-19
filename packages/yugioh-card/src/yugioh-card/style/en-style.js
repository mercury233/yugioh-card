import { inheritProp } from '../../utils/index.js';

export default inheritProp({
  fontFamily: 'ygo-en',
  name: {
    fontFamily: 'ygo-en-name',
    top: 25,
    fontSize: 77,
    letterSpacing: 0.5,
  },
  spellTrap: {
    fontFamily: 'ygo-en-race',
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
    lineHeight: 1.05,
    height: 107,
  },
  effect: {
    fontFamily: 'ygo-en-race',
    top: 742,
    fontSize: 27,
    letterSpacing: 0.5,
    textIndent: -2,
    lineHeight: 1,
  },
  description: {
    left: 55,
    width: 569,
    height: 178,
    fontSize: 20,
    lineHeight: 1.05,
  },
});
