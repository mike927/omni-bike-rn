import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text } from 'react-native';

import { WorkoutHistoryListItem } from '../components/WorkoutHistoryListItem';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../training/navigation/trainingSummaryRoute';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const HISTORY_ROUTE = '/history';
const HOME_ROUTE = '/';

export function HistoryScreen() {
  const router = useRouter();
  const { sessions, isLoading, deleteWorkout } = useWorkoutHistory();

  const handlePressSession = (sessionId: string) => {
    router.push(buildTrainingSummaryRoute(sessionId, SAVED_SESSION_TRAINING_SUMMARY_SOURCE, HISTORY_ROUTE));
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Workout?', 'Are you sure you want to delete this session? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteWorkout(sessionId),
      },
    ]);
  };

  return (
    <AppScreen title="History" noScroll={true}>
      {isLoading ? (
        <SectionCard title="Loading Workouts">
          <Text style={styles.bodyText}>Loading your saved sessions.</Text>
        </SectionCard>
      ) : sessions.length === 0 ? (
        <SectionCard title="No Workouts Yet">
          <Text style={styles.bodyText}>Your completed cycling sessions will appear here.</Text>
          <ActionButton label="Start Training" onPress={() => router.replace(HOME_ROUTE)} />
        </SectionCard>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WorkoutHistoryListItem
              session={item}
              onPress={() => handlePressSession(item.id)}
              onDelete={() => handleDeleteSession(item.id)}
            />
          )}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  list: {
    flex: 1,
  },
});
