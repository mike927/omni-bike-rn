import { type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette } from '../../../ui/theme';

interface IllustrationProps {
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export function Page2HrIllustration({ style, testID }: IllustrationProps) {
  return (
    <Svg viewBox="0 0 400 400" style={style} testID={testID}>
      <Defs>
        <LinearGradient id="page2Backdrop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.primarySubtle} stopOpacity="1" />
          <Stop offset="1" stopColor={palette.surface} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      <Circle cx="200" cy="200" r="170" fill="url(#page2Backdrop)" />

      <Path
        d="M200 280
           C200 280, 110 230, 110 175
           C110 145, 132 125, 158 125
           C178 125, 192 138, 200 152
           C208 138, 222 125, 242 125
           C268 125, 290 145, 290 175
           C290 230, 200 280, 200 280 Z"
        fill="none"
        stroke={palette.danger}
        strokeWidth="8"
        strokeLinejoin="round"
      />

      <Path
        d="M110 200 L150 200 L168 168 L188 232 L208 188 L228 212 L250 200 L290 200"
        fill="none"
        stroke={palette.primary}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Rect x="160" y="298" width="80" height="56" rx="14" fill="none" stroke={palette.primary} strokeWidth="8" />
      <Path
        d="M188 298 L188 282 L212 282 L212 298"
        fill="none"
        stroke={palette.primary}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <Path
        d="M188 354 L188 370 L212 370 L212 354"
        fill="none"
        stroke={palette.primary}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <Circle cx="200" cy="326" r="6" fill={palette.secondary} />
    </Svg>
  );
}
