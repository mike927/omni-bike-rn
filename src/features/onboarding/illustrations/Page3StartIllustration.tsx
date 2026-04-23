import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette } from '../../../ui/theme';
import { IllustrationBackdrop, type IllustrationProps } from './IllustrationBackdrop';

export function Page3StartIllustration({ style, testID }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 400 400" style={style} testID={testID}>
      <IllustrationBackdrop />
      <Defs>
        <LinearGradient id="page3Bolt" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.primary} stopOpacity="1" />
          <Stop offset="1" stopColor={palette.secondary} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      <Path d="M90 210 L150 210" stroke={palette.secondary} strokeWidth="8" strokeLinecap="round" opacity="0.45" />
      <Path d="M70 175 L130 175" stroke={palette.secondary} strokeWidth="8" strokeLinecap="round" opacity="0.7" />
      <Path d="M80 245 L140 245" stroke={palette.secondary} strokeWidth="8" strokeLinecap="round" opacity="0.55" />

      <Path
        d="M232 90 L160 220 L210 220 L188 320 L268 180 L218 180 Z"
        fill="url(#page3Bolt)"
        stroke={palette.primary}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
