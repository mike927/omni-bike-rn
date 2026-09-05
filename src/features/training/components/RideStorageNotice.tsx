import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';
import type { StorageNotice } from '../screens/trainingViewModel';

export interface RideStorageNoticeProps {
  readonly notice: StorageNotice;
  readonly busy: boolean;
  readonly onRetrySave: () => void | Promise<void>;
  readonly onDiscard: () => void | Promise<void>;
}

/**
 * Tells the truth about where the ride is stored (audit A02).
 *
 * A finished ride that failed to save is the one case with actions: it is still
 * in memory and only the user may decide between another attempt and throwing it
 * away, so both buttons stay on screen until one of them is pressed.
 */
export function RideStorageNotice({ notice, busy, onRetrySave, onDiscard }: RideStorageNoticeProps) {
  if (notice.kind === 'none') {
    return null;
  }

  const isUnsaved = notice.kind === 'unsaved';

  return (
    <View style={[styles.notice, isUnsaved ? styles.noticeDanger : styles.noticeWarning]}>
      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.body}>{notice.body}</Text>
      {isUnsaved ? (
        <View style={styles.actions}>
          <View style={styles.half}>
            <ActionButton
              label={busy ? 'Saving...' : 'Retry Save'}
              onPress={onRetrySave}
              variant="primary"
              scheme="noir"
              disabled={busy}
              fullWidth
            />
          </View>
          <View style={styles.half}>
            <ActionButton
              label="Discard Ride"
              onPress={onDiscard}
              variant="ghost"
              scheme="noir"
              disabled={busy}
              fullWidth
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  noticeWarning: {
    borderColor: 'rgba(245,165,36,0.22)',
    backgroundColor: 'rgba(245,165,36,0.08)',
  },
  noticeDanger: {
    borderColor: 'rgba(239,75,92,0.26)',
    backgroundColor: 'rgba(239,75,92,0.09)',
  },
  title: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  body: { color: noir.ink2, fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 11, marginTop: 2 },
  half: { flex: 1 },
});
