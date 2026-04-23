import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { gradient } from '../../../ui/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PULSE_DURATION = 800;

export function BluetoothConnector({ testID }: { readonly testID?: string }) {
  const leftOpacity = useSharedValue(0.45);
  const rightOpacity = useSharedValue(0.45);

  useEffect(() => {
    leftOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.2, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    rightOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.7, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [leftOpacity, rightOpacity]);

  const leftAnimatedProps = useAnimatedProps(() => ({ opacity: leftOpacity.value }));
  const rightAnimatedProps = useAnimatedProps(() => ({ opacity: rightOpacity.value }));

  return (
    <View style={styles.frame} testID={testID}>
      <Svg viewBox="0 0 36 36" width="36" height="36">
        <Defs>
          <LinearGradient id="connectorGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient.cool[0]} />
            <Stop offset="1" stopColor={gradient.cool[1]} />
          </LinearGradient>
        </Defs>
        <AnimatedPath
          d="M 9 14 Q 5.5 18 9 22"
          fill="none"
          stroke="url(#connectorGrad)"
          strokeWidth="1.4"
          strokeLinecap="round"
          animatedProps={leftAnimatedProps}
        />
        <AnimatedPath
          d="M 27 14 Q 30.5 18 27 22"
          fill="none"
          stroke="url(#connectorGrad)"
          strokeWidth="1.4"
          strokeLinecap="round"
          animatedProps={rightAnimatedProps}
        />
        <Path
          d="M 18 10 L 18 26 M 18 10 L 22 14 L 14 22 M 18 26 L 22 22 L 14 14"
          fill="none"
          stroke="url(#connectorGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
