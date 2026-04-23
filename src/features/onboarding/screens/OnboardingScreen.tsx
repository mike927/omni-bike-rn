import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppPreferencesStore } from '../../../store/appPreferencesStore';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import { Page1BikeIllustration } from '../illustrations/Page1BikeIllustration';
import { Page2HrIllustration } from '../illustrations/Page2HrIllustration';
import { Page3StartIllustration } from '../illustrations/Page3StartIllustration';
import { OnboardingActionButton } from './OnboardingActionButton';

type IllustrationComponent = ComponentType<{ readonly style?: ViewStyle; readonly testID?: string }>;

interface OnboardingPage {
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly Illustration: IllustrationComponent;
  readonly illustrationTestID: string;
}

const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    eyebrow: 'Step 1',
    title: 'Connect your bike',
    description: 'Pair your FTMS indoor bike to unlock live speed, power, cadence, and distance tracking.',
    Illustration: Page1BikeIllustration,
    illustrationTestID: 'onboarding-illustration-bike',
  },
  {
    eyebrow: 'Step 2',
    title: 'Add heart rate if you want it',
    description: 'A Bluetooth chest strap or compatible watch can join the ride, but it is completely optional.',
    Illustration: Page2HrIllustration,
    illustrationTestID: 'onboarding-illustration-hr',
  },
  {
    eyebrow: 'Step 3',
    title: 'Start training fast',
    description: 'Saved gear reconnects automatically so your next ride can start from Home with one tap.',
    Illustration: Page3StartIllustration,
    illustrationTestID: 'onboarding-illustration-start',
  },
];

const ENTRANCE_DURATION = 280;
const TEXT_STAGGER = 60;
const ENTRANCE_EASING = Easing.out(Easing.cubic);

export function getOnboardingPageWidth(windowWidth: number): number {
  return Math.max(windowWidth - 40, 280);
}

export function getOnboardingPageIndex(offsetX: number, pageWidth: number): number {
  return Math.round(offsetX / pageWidth);
}

export function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<Animated.ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const completeOnboarding = useAppPreferencesStore((s) => s.completeOnboarding);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageWidth = getOnboardingPageWidth(width);

  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const isLastPage = currentPageIndex === ONBOARDING_PAGES.length - 1;

  const handleDone = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  const handlePrimaryAction = () => {
    if (isLastPage) {
      void handleDone();
      return;
    }

    const nextPageIndex = currentPageIndex + 1;
    scrollViewRef.current?.scrollTo({ x: nextPageIndex * pageWidth, animated: true });
    setCurrentPageIndex(nextPageIndex);
  };

  return (
    <AppScreen
      title="Welcome to Omni Bike"
      subtitle="A quick intro before you land on Home for the first time."
      contentContainerStyle={styles.screenContent}
      noScroll>
      <View style={styles.content}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const nextPageIndex = getOnboardingPageIndex(event.nativeEvent.contentOffset.x, pageWidth);
            setCurrentPageIndex(nextPageIndex);
          }}>
          {ONBOARDING_PAGES.map((page, index) => (
            <OnboardingPageContent
              key={page.title}
              page={page}
              isActive={index === currentPageIndex}
              pageWidth={pageWidth}
            />
          ))}
        </Animated.ScrollView>

        <View style={styles.dotsRow}>
          {ONBOARDING_PAGES.map((page, index) => (
            <Pressable
              key={page.title}
              accessibilityRole="button"
              accessibilityLabel={`Go to onboarding page ${index + 1}`}
              hitSlop={8}
              onPress={() => {
                scrollViewRef.current?.scrollTo({ x: index * pageWidth, animated: true });
                setCurrentPageIndex(index);
              }}>
              <DotIndicator index={index} scrollX={scrollX} pageWidth={pageWidth} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actionRow}>
          <OnboardingActionButton label="Skip" onPress={() => void handleDone()} variant="ghost" />
          <OnboardingActionButton label={isLastPage ? 'Done' : 'Next'} onPress={handlePrimaryAction} />
        </View>
      </View>
    </AppScreen>
  );
}

interface OnboardingPageContentProps {
  readonly page: OnboardingPage;
  readonly isActive: boolean;
  readonly pageWidth: number;
}

function OnboardingPageContent({ page, isActive, pageWidth }: OnboardingPageContentProps) {
  const illustrationOpacity = useSharedValue(isActive ? 1 : 0);
  const illustrationScale = useSharedValue(isActive ? 1 : 0.96);
  const textOpacity = useSharedValue(isActive ? 1 : 0);
  const textTranslateY = useSharedValue(isActive ? 0 : 16);

  useEffect(() => {
    if (!isActive) {
      illustrationOpacity.value = 0;
      illustrationScale.value = 0.96;
      textOpacity.value = 0;
      textTranslateY.value = 16;
      return;
    }

    illustrationOpacity.value = withTiming(1, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING });
    illustrationScale.value = withTiming(1, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING });
    textOpacity.value = withDelay(
      TEXT_STAGGER,
      withTiming(1, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING }),
    );
    textTranslateY.value = withDelay(
      TEXT_STAGGER,
      withTiming(0, { duration: ENTRANCE_DURATION, easing: ENTRANCE_EASING }),
    );
  }, [isActive, illustrationOpacity, illustrationScale, textOpacity, textTranslateY]);

  const illustrationStyle = useAnimatedStyle(() => ({
    opacity: illustrationOpacity.value,
    transform: [{ scale: illustrationScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <Animated.View style={[styles.illustrationFrame, illustrationStyle]}>
        <page.Illustration style={styles.illustration} testID={page.illustrationTestID} />
      </Animated.View>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.eyebrow}>{page.eyebrow}</Text>
        <Text style={styles.pageTitle}>{page.title}</Text>
        <Text style={styles.pageDescription}>{page.description}</Text>
      </Animated.View>
    </View>
  );
}

interface DotIndicatorProps {
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
}

function DotIndicator({ index, scrollX, pageWidth }: DotIndicatorProps) {
  const dotStyle = useAnimatedStyle(() => {
    const position = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const distance = Math.abs(position - index);
    const dotWidth = interpolate(distance, [0, 1], [28, 10], Extrapolation.CLAMP);
    const backgroundColor = interpolateColor(distance, [0, 1], [palette.primary, palette.border]);
    return { width: dotWidth, backgroundColor };
  });

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },
  page: {
    paddingRight: 12,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 24,
  },
  illustrationFrame: {
    aspectRatio: 1,
    width: '100%',
    maxHeight: 320,
    alignSelf: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    gap: 12,
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pageTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  pageDescription: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    height: 10,
    borderRadius: 999,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
});
