import { useLocalSearchParams } from 'expo-router';

import {
  resolveTrainingSummaryReturnTo,
  resolveTrainingSummarySource,
} from '../src/features/training/navigation/trainingSummaryRoute';
import { TrainingSummaryScreen } from '../src/features/training/screens/TrainingSummaryScreen';

export default function SummaryRoute() {
  const { sessionId, source, returnTo } = useLocalSearchParams<{
    sessionId: string;
    source?: string | string[];
    returnTo?: string | string[];
  }>();

  // The screen renders its own Calm Noir header (the route is headerShown: false in
  // app/_layout.tsx); back-button visibility is derived from `source` inside the screen.
  return (
    <TrainingSummaryScreen
      sessionId={sessionId ?? ''}
      source={resolveTrainingSummarySource(source)}
      returnTo={resolveTrainingSummaryReturnTo(returnTo)}
    />
  );
}
