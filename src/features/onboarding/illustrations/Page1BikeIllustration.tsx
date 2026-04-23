import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../../../ui/theme';
import { IllustrationBackdrop, type IllustrationProps } from './IllustrationBackdrop';

export function Page1BikeIllustration({ style, testID }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 400 400" style={style} testID={testID}>
      <IllustrationBackdrop />

      <Circle cx="135" cy="270" r="58" fill="none" stroke={palette.primary} strokeWidth="8" />
      <Circle cx="135" cy="270" r="6" fill={palette.primary} />
      <Circle cx="295" cy="270" r="58" fill="none" stroke={palette.primary} strokeWidth="8" />
      <Circle cx="295" cy="270" r="6" fill={palette.primary} />

      <Path
        d="M135 270 L215 270 L240 175 L295 270 Z"
        fill="none"
        stroke={palette.primary}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <Path d="M240 175 L218 175" stroke={palette.primary} strokeWidth="8" strokeLinecap="round" />
      <Path d="M225 175 L260 152" stroke={palette.primary} strokeWidth="8" strokeLinecap="round" />
      <Path d="M255 148 L275 148" stroke={palette.primary} strokeWidth="8" strokeLinecap="round" />

      <Path
        d="M295 130 Q318 130 318 110"
        fill="none"
        stroke={palette.secondary}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M310 145 Q345 145 345 110"
        fill="none"
        stroke={palette.secondary}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Path
        d="M325 160 Q372 160 372 110"
        fill="none"
        stroke={palette.secondary}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </Svg>
  );
}
