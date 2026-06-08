import { StyleSheet, View } from 'react-native';

import { ActionButton } from '../../../ui/components/ActionButton';
import type { TrainingControls } from '../screens/trainingViewModel';

export interface RideControlsProps {
  readonly controls: TrainingControls;
  readonly isFinishing: boolean;
  readonly onStart: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onFinish: () => void | Promise<void>;
}

export function RideControls({ controls, isFinishing, onStart, onPause, onResume, onFinish }: RideControlsProps) {
  if (controls.kind === 'finishing') {
    // Session has ended; no Start/Resume until cleanup + navigation complete.
    return <ActionButton label="Finishing..." onPress={noop} variant="primary" scheme="noir" disabled fullWidth />;
  }

  if (controls.kind === 'idle') {
    return (
      <ActionButton
        label="Start Ride"
        onPress={onStart}
        variant="primary"
        scheme="noir"
        disabled={controls.startDisabled}
        accessibilityHint={controls.startDisabled ? 'Connect your smart bike to start a ride.' : undefined}
        fullWidth
      />
    );
  }

  const primary =
    controls.kind === 'active' ? (
      <ActionButton label="Pause" onPress={onPause} variant="primary" scheme="noir" fullWidth />
    ) : (
      <ActionButton
        label="Resume"
        onPress={onResume}
        variant="primary"
        scheme="noir"
        disabled={controls.resumeDisabled}
        accessibilityHint={controls.resumeDisabled ? 'Reconnect your smart bike to resume.' : undefined}
        fullWidth
      />
    );

  return (
    <View style={styles.row}>
      <View style={styles.half}>{primary}</View>
      <View style={styles.half}>
        <ActionButton
          label={isFinishing ? 'Finishing...' : 'Finish'}
          onPress={onFinish}
          variant="danger"
          scheme="noir"
          disabled={isFinishing}
          fullWidth
        />
      </View>
    </View>
  );
}

function noop() {}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 11 },
  half: { flex: 1 },
});
