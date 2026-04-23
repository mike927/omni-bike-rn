import { type ComponentProps } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ActionButton } from '../../../ui/components/ActionButton';

type OnboardingActionButtonProps = ComponentProps<typeof ActionButton>;

const PRESS_DURATION = 90;
const RELEASE_DURATION = 140;
const PRESS_SCALE = 0.97;

export function OnboardingActionButton(props: OnboardingActionButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const release = () => {
    scale.value = withTiming(1, { duration: RELEASE_DURATION, easing: Easing.out(Easing.quad) });
  };

  return (
    <Animated.View
      style={animatedStyle}
      onTouchStart={() => {
        scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION, easing: Easing.out(Easing.quad) });
      }}
      onTouchEnd={release}
      onTouchCancel={release}>
      <ActionButton {...props} />
    </Animated.View>
  );
}
