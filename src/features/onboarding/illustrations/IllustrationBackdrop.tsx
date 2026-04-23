import { type ViewStyle } from 'react-native';
import { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { palette } from '../../../ui/theme';

export interface IllustrationProps {
  readonly style?: ViewStyle;
  readonly testID?: string;
}

const BACKDROP_ID = 'onboardingIllustrationBackdrop';

export function IllustrationBackdrop() {
  return (
    <>
      <Defs>
        <LinearGradient id={BACKDROP_ID} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.primarySubtle} stopOpacity="1" />
          <Stop offset="1" stopColor={palette.surface} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Circle cx="200" cy="200" r="170" fill={`url(#${BACKDROP_ID})`} />
    </>
  );
}
