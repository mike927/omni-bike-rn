import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useAppPreferencesStore } from '../../../store/appPreferencesStore';
import { ActionButton } from '../../../ui/components/ActionButton';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

interface OnboardingPage {
  title: string;
  description: string;
  eyebrow: string;
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    eyebrow: 'Step 1',
    title: 'Connect your bike',
    description: 'Pair your FTMS indoor bike to unlock live speed, power, cadence, and distance tracking.',
  },
  {
    eyebrow: 'Step 2',
    title: 'Add heart rate if you want it',
    description: 'A Bluetooth chest strap or compatible watch can join the ride, but it is completely optional.',
  },
  {
    eyebrow: 'Step 3',
    title: 'Start training fast',
    description: 'Saved gear reconnects automatically so your next ride can start from Home with one tap.',
  },
];

export function getOnboardingPageWidth(windowWidth: number): number {
  return Math.max(windowWidth - 40, 280);
}

export function getOnboardingPageIndex(offsetX: number, pageWidth: number): number {
  return Math.round(offsetX / pageWidth);
}

export function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const completeOnboarding = useAppPreferencesStore((s) => s.completeOnboarding);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageWidth = getOnboardingPageWidth(width);

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
      contentContainerStyle={styles.screenContent}>
      <View style={styles.content}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const nextPageIndex = getOnboardingPageIndex(event.nativeEvent.contentOffset.x, pageWidth);
            setCurrentPageIndex(nextPageIndex);
          }}>
          {ONBOARDING_PAGES.map((page) => (
            <View key={page.title} style={[styles.page, { width: pageWidth }]}>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>{page.eyebrow}</Text>
                <Text style={styles.pageTitle}>{page.title}</Text>
                <Text style={styles.pageDescription}>{page.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dotsRow}>
          {ONBOARDING_PAGES.map((page, index) => (
            <Pressable
              key={page.title}
              accessibilityRole="button"
              accessibilityLabel={`Go to onboarding page ${index + 1}`}
              onPress={() => {
                scrollViewRef.current?.scrollTo({ x: index * pageWidth, animated: true });
                setCurrentPageIndex(index);
              }}
              style={[styles.dot, index === currentPageIndex ? styles.dotActive : null]}
            />
          ))}
        </View>

        <View style={styles.actionRow}>
          <ActionButton label="Skip" onPress={() => void handleDone()} variant="ghost" />
          <ActionButton label={isLastPage ? 'Done' : 'Next'} onPress={handlePrimaryAction} />
        </View>
      </View>
    </AppScreen>
  );
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
  },
  hero: {
    minHeight: 280,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 24,
    justifyContent: 'flex-end',
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
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.border,
  },
  dotActive: {
    width: 28,
    backgroundColor: palette.primary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
});
