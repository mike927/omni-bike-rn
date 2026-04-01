import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  resolveTrainingSummaryReturnTo,
  resolveTrainingSummarySource,
  shouldShowSummaryHeaderBack,
} from '../src/features/training/navigation/trainingSummaryRoute';
import { TrainingSummaryScreen } from '../src/features/training/screens/TrainingSummaryScreen';
import { palette } from '../src/ui/theme';

export default function SummaryRoute() {
  const router = useRouter();
  const { sessionId, source, returnTo } = useLocalSearchParams<{
    sessionId: string;
    source?: string | string[];
    returnTo?: string | string[];
  }>();
  const resolvedSource = resolveTrainingSummarySource(source);
  const resolvedReturnTo = resolveTrainingSummaryReturnTo(returnTo);
  const showHeaderBack = shouldShowSummaryHeaderBack(resolvedSource);

  const handleHeaderBack = () => {
    router.replace(resolvedReturnTo ?? '/');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: showHeaderBack
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={handleHeaderBack}>
                  <Text style={styles.headerBackLabel}>Back</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <TrainingSummaryScreen sessionId={sessionId ?? ''} source={resolvedSource} returnTo={resolvedReturnTo} />
    </>
  );
}

const styles = StyleSheet.create({
  headerBackLabel: {
    color: palette.surface,
    fontSize: 17,
    fontWeight: '600',
  },
});
