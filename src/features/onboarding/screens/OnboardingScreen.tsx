import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppPreferencesStore } from '../../../store/appPreferencesStore';
import { palette } from '../../../ui/theme';
import { OnboardingPrimaryButton } from '../components/OnboardingPrimaryButton';
import { OnboardingProgressBar } from '../components/OnboardingProgressBar';
import { OnboardingSecondaryButton } from '../components/OnboardingSecondaryButton';
import { Page1BikeIllustration } from '../illustrations/Page1BikeIllustration';
import { Page2HrIllustration } from '../illustrations/Page2HrIllustration';
import { Page3StartIllustration } from '../illustrations/Page3StartIllustration';

type IllustrationComponent = ComponentType<{ readonly style?: ViewStyle; readonly testID?: string }>;

interface OnboardingPage {
  readonly headline: string;
  readonly subtitle: string;
  readonly Illustration: IllustrationComponent;
  readonly illustrationTestID: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string | null;
  readonly bottomPadding: number;
}

const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    headline: 'See your ride in real time',
    subtitle: 'Pair your FTMS bike to stream live speed, power, cadence, and distance.',
    Illustration: Page1BikeIllustration,
    illustrationTestID: 'onboarding-illustration-bike',
    primaryLabel: 'Search for Bike',
    secondaryLabel: 'Skip',
    bottomPadding: 80,
  },
  {
    headline: 'Train to your heart rate',
    subtitle:
      'Connect a Bluetooth chest strap, Apple Watch, or other compatible watch. Optional — you can add one anytime.',
    Illustration: Page2HrIllustration,
    illustrationTestID: 'onboarding-illustration-hr',
    primaryLabel: 'Pair Device',
    secondaryLabel: 'Skip',
    bottomPadding: 80,
  },
  {
    headline: "One tap and you're riding",
    subtitle: 'Saved gear reconnects automatically, so your next workout starts from Home.',
    Illustration: Page3StartIllustration,
    illustrationTestID: 'onboarding-illustration-start',
    primaryLabel: 'Finish',
    secondaryLabel: null,
    bottomPadding: 80,
  },
];

export function getOnboardingPageWidth(windowWidth: number): number {
  return Math.max(windowWidth, 320);
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
  const currentPage = ONBOARDING_PAGES[currentPageIndex] ?? ONBOARDING_PAGES[0];
  if (!currentPage) {
    return null;
  }

  // Equality guard dedupes writes from programmatic scrollTo + onMomentumScrollEnd.
  const goToPage = (nextPageIndex: number) => {
    scrollViewRef.current?.scrollTo({ x: nextPageIndex * pageWidth, animated: true });
    setCurrentPageIndex((current) => (current === nextPageIndex ? current : nextPageIndex));
  };

  const handleDone = async () => {
    await completeOnboarding();
    router.replace('/');
  };

  const handlePrimaryAction = () => {
    if (isLastPage) {
      void handleDone();
      return;
    }
    goToPage(currentPageIndex + 1);
  };

  const handleSecondaryAction = () => {
    if (isLastPage) return;
    goToPage(currentPageIndex + 1);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <OnboardingProgressBar total={ONBOARDING_PAGES.length} scrollX={scrollX} pageWidth={pageWidth} />
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const nextPageIndex = getOnboardingPageIndex(event.nativeEvent.contentOffset.x, pageWidth);
          setCurrentPageIndex((current) => (current === nextPageIndex ? current : nextPageIndex));
        }}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}>
        {ONBOARDING_PAGES.map((page, index) => (
          <OnboardingPageContent
            key={page.headline}
            page={page}
            index={index}
            scrollX={scrollX}
            pageWidth={pageWidth}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: currentPage.bottomPadding }]}>
        <OnboardingPrimaryButton label={currentPage.primaryLabel} onPress={handlePrimaryAction} />
        {currentPage.secondaryLabel ? (
          <OnboardingSecondaryButton label={currentPage.secondaryLabel} onPress={handleSecondaryAction} />
        ) : (
          <View style={styles.secondarySlotSpacer} />
        )}
      </View>
    </SafeAreaView>
  );
}

interface OnboardingPageContentProps {
  readonly page: OnboardingPage;
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
}

function OnboardingPageContent({ page, index, scrollX, pageWidth }: OnboardingPageContentProps) {
  const illustrationStyle = useAnimatedStyle(() => {
    const distance = pageWidth > 0 ? Math.abs(scrollX.value / pageWidth - index) : 0;
    return {
      opacity: interpolate(distance, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.96], Extrapolation.CLAMP) }],
    };
  });

  // Tighter input range than the illustration so text "trails" into focus.
  const textStyle = useAnimatedStyle(() => {
    const distance = pageWidth > 0 ? Math.abs(scrollX.value / pageWidth - index) : 0;
    return {
      opacity: interpolate(distance, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(distance, [0, 0.5], [0, 16], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={[styles.page, { width: pageWidth }]}>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <Text style={styles.headline} numberOfLines={2}>
          {page.headline}
        </Text>
        <Text style={styles.subtitle} numberOfLines={3}>
          {page.subtitle}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.illustration, illustrationStyle]}>
        <page.Illustration testID={page.illustrationTestID} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'stretch',
  },
  page: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flex: 1,
    alignItems: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 448,
  },
  headline: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.6,
    textAlign: 'center',
    minHeight: 72,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    minHeight: 78,
  },
  illustration: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  secondarySlotSpacer: {
    height: 56,
  },
});
