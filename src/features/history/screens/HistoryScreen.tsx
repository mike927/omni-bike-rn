import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WorkoutHistoryListItem } from '../components/WorkoutHistoryListItem';
import { HistorySummaryStrip } from '../components/HistorySummaryStrip';
import { deriveHistorySummary } from '../historySummary';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import {
  buildTrainingSummaryRoute,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../training/navigation/trainingSummaryRoute';
import { noir } from '../../../ui/theme';

const HISTORY_ROUTE = '/history';
const HOME_ROUTE = '/';

function ScreenHead() {
  return (
    <View style={styles.head}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subline}>Your completed rides.</Text>
    </View>
  );
}

export function HistoryScreen() {
  const router = useRouter();
  const { items, isLoading, loadError, deleteWorkout, refresh } = useWorkoutHistory();

  const handlePressSession = (sessionId: string) => {
    router.push(buildTrainingSummaryRoute(sessionId, SAVED_SESSION_TRAINING_SUMMARY_SOURCE, HISTORY_ROUTE));
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Workout?', 'Are you sure you want to delete this session? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!deleteWorkout(sessionId)) {
            Alert.alert('Couldn’t Delete Workout', 'Something went wrong deleting this session. Please try again.');
          }
        },
      },
    ]);
  };

  const summary = deriveHistorySummary(
    items.map((item) => item.session),
    new Date(),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.stateContent} showsVerticalScrollIndicator={false}>
          <ScreenHead />
          <View style={styles.stateCard}>
            <Text style={styles.stateBody}>Loading your saved sessions.</Text>
          </View>
        </ScrollView>
      ) : loadError && items.length === 0 ? (
        <ScrollView contentContainerStyle={styles.stateContent} showsVerticalScrollIndicator={false}>
          <ScreenHead />
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Could Not Load Workouts</Text>
            <Text style={styles.stateBody}>Something went wrong reading your saved sessions.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={refresh}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaLabel}>Retry</Text>
              <Ionicons name="refresh" size={16} color={noir.indigoSoft} />
            </Pressable>
          </View>
        </ScrollView>
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={styles.stateContent} showsVerticalScrollIndicator={false}>
          <ScreenHead />
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No Workouts Yet</Text>
            <Text style={styles.stateBody}>Your completed cycling sessions will appear here.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start Training"
              onPress={() => router.replace(HOME_ROUTE)}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaLabel}>Start Training</Text>
              <Ionicons name="chevron-forward" size={16} color={noir.indigoSoft} />
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.session.id}
          ListHeaderComponent={
            <View>
              <ScreenHead />
              <HistorySummaryStrip summary={summary} />
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionTitle}>Recent rides</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <WorkoutHistoryListItem
              session={item.session}
              uploadedProviderIds={item.uploadedProviderIds}
              onPress={() => handlePressSession(item.session.id)}
              onDelete={() => handleDeleteSession(item.session.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: noir.bg,
  },
  listContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 32,
  },
  stateContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 32,
  },
  head: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: noir.ink,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subline: {
    color: noir.ink2,
    fontSize: 14.5,
    lineHeight: 20,
    marginTop: 9,
    maxWidth: 320,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: noir.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 10,
  },
  stateCard: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  stateTitle: {
    color: noir.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  stateBody: {
    color: noir.ink2,
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: noir.hairline,
    backgroundColor: noir.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
  },
  ctaPressed: {
    backgroundColor: '#232c3d',
  },
  ctaLabel: {
    color: noir.indigoText,
    fontSize: 14,
    fontWeight: '700',
  },
});
