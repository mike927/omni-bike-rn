import { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import { loadProfileFromAppleHealth } from '../../../services/health/appleHealthAdapter';
import { loadProfileFromStrava } from '../../../services/strava/stravaProfileService';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import { useUserProfileStore } from '../../../store/userProfileStore';
import type { BiologicalSex, ProfileFieldSource } from '../../../types/userProfile';

const SOURCE_LABELS: Record<ProfileFieldSource, string> = {
  'apple-health': 'Apple Health',
  strava: 'Strava',
  manual: 'Manual',
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatSourceBadge(source: ProfileFieldSource | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source];
}

function parseFiniteNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseDateInput(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (!ISO_DATE_PATTERN.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return trimmed;
}

interface FieldRowProps {
  readonly label: string;
  readonly source: ProfileFieldSource | undefined;
  readonly children: React.ReactNode;
  readonly canClear: boolean;
  readonly onClear: () => void;
}

function FieldRow({ label, source, children, canClear, onClear }: FieldRowProps) {
  const sourceBadge = formatSourceBadge(source);
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sourceBadge ? (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
          </View>
        ) : null}
      </View>
      {children}
      {canClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          onPress={onClear}
          style={({ pressed }) => [styles.clearButton, pressed ? styles.clearButtonPressed : null]}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface SexSegmentProps {
  readonly value: BiologicalSex | null;
  readonly onChange: (value: BiologicalSex) => void;
}

function SexSegment({ value, onChange }: SexSegmentProps) {
  return (
    <View style={styles.segmentedControl} accessibilityRole="radiogroup">
      {(['male', 'female'] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={option === 'male' ? 'Male' : 'Female'}
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed && !selected ? styles.segmentPressed : null,
            ]}>
            <Text style={[styles.segmentLabel, selected ? styles.segmentLabelSelected : null]}>
              {option === 'male' ? 'Male' : 'Female'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface NumericFieldProps {
  readonly value: number | null;
  readonly suffix: string;
  readonly placeholder: string;
  readonly onCommit: (value: number | null) => void;
}

function NumericField({ value, suffix, placeholder, onCommit }: NumericFieldProps) {
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value));

  useEffect(() => {
    setDraft(value === null ? '' : String(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseFiniteNumber(draft);
    // Blur never clears the field — only the explicit Clear button does.
    // Empty or invalid drafts revert to the last committed value so a stray
    // tap mid-edit can't wipe a number the user already saved.
    if (parsed === null) {
      setDraft(value === null ? '' : String(value));
      return;
    }
    setDraft(String(parsed));
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <View style={styles.inputRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        style={styles.input}
      />
      <Text style={styles.inputSuffix}>{suffix}</Text>
    </View>
  );
}

interface DateFieldProps {
  readonly value: string | null;
  readonly onCommit: (value: string | null) => void;
}

function DateField({ value, onCommit }: DateFieldProps) {
  const [draft, setDraft] = useState<string>(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const handleBlur = () => {
    const parsed = parseDateInput(draft);
    // Blur never clears the field — only the explicit Clear button does.
    // An empty or partially-typed date reverts to the last committed value so
    // a stray tap mid-edit can't silently wipe a saved DOB.
    if (parsed === null) {
      setDraft(value ?? '');
      return;
    }
    setDraft(parsed);
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <View style={styles.inputRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={handleBlur}
        keyboardType="numbers-and-punctuation"
        placeholder="yyyy-mm-dd"
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing'; source: 'apple-health' | 'strava' }
  | { kind: 'success'; source: 'apple-health' | 'strava'; fieldCount: number }
  | { kind: 'error'; source: 'apple-health' | 'strava'; message: string };

export function UserProfileScreen() {
  const profile = useUserProfileStore((s) => s.profile);
  const setManual = useUserProfileStore((s) => s.setManual);
  const applyProviderSync = useUserProfileStore((s) => s.applyProviderSync);
  const appleHealthConnected = useAppleHealthConnectionStore((s) => s.connected);
  const stravaConnected = useStravaConnectionStore((s) => s.connected);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'idle' });

  const isEmpty = useMemo(
    () =>
      profile.sex === null && profile.dateOfBirth === null && profile.weightKg === null && profile.heightCm === null,
    [profile.sex, profile.dateOfBirth, profile.weightKg, profile.heightCm],
  );
  const noProviderConnected = !appleHealthConnected && !stravaConnected;

  const handleSyncFromAppleHealth = async () => {
    setSyncStatus({ kind: 'syncing', source: 'apple-health' });
    try {
      const partial = await loadProfileFromAppleHealth();
      await applyProviderSync('apple-health', partial);
      setSyncStatus({ kind: 'success', source: 'apple-health', fieldCount: Object.keys(partial).length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Apple Health sync failed.';
      setSyncStatus({ kind: 'error', source: 'apple-health', message });
    }
  };

  const handleSyncFromStrava = async () => {
    setSyncStatus({ kind: 'syncing', source: 'strava' });
    try {
      const partial = await loadProfileFromStrava();
      await applyProviderSync('strava', partial);
      setSyncStatus({ kind: 'success', source: 'strava', fieldCount: Object.keys(partial).length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Strava sync failed.';
      setSyncStatus({ kind: 'error', source: 'strava', message });
    }
  };

  return (
    <AppScreen
      title="User Profile"
      subtitle="Used for accurate calorie estimation when training without an Apple Watch.">
      <SectionCard title="Sync from a provider">
        {noProviderConnected ? (
          <Text style={styles.helperText}>
            Connect Apple Health or Strava in Settings to sync your profile, or fill in the fields below manually.
          </Text>
        ) : (
          <Text style={styles.helperText}>
            Tap a provider to overwrite your profile fields with the latest values. Fields the provider doesn&apos;t
            return are left untouched.
          </Text>
        )}
        <View style={styles.syncButtonRow}>
          <ActionButton
            label={
              syncStatus.kind === 'syncing' && syncStatus.source === 'apple-health'
                ? 'Syncing…'
                : 'Sync from Apple Health'
            }
            variant="secondary"
            disabled={!appleHealthConnected || syncStatus.kind === 'syncing'}
            onPress={handleSyncFromAppleHealth}
          />
          <ActionButton
            label={syncStatus.kind === 'syncing' && syncStatus.source === 'strava' ? 'Syncing…' : 'Sync from Strava'}
            variant="secondary"
            disabled={!stravaConnected || syncStatus.kind === 'syncing'}
            onPress={handleSyncFromStrava}
          />
        </View>
        {syncStatus.kind === 'success' ? (
          <Text style={styles.syncSuccessText}>
            {syncStatus.fieldCount > 0
              ? `Updated ${syncStatus.fieldCount} field${syncStatus.fieldCount === 1 ? '' : 's'} from ${SOURCE_LABELS[syncStatus.source]}.`
              : `${SOURCE_LABELS[syncStatus.source]} returned no profile data.`}
          </Text>
        ) : null}
        {syncStatus.kind === 'error' ? (
          <Text style={styles.syncErrorText}>
            {SOURCE_LABELS[syncStatus.source]} sync failed: {syncStatus.message}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Personal">
        <FieldRow
          label="Sex"
          source={profile.sources.sex}
          canClear={profile.sex !== null}
          onClear={() => void setManual('sex', null)}>
          <SexSegment value={profile.sex} onChange={(value) => void setManual('sex', value)} />
        </FieldRow>

        <View style={styles.divider} />

        <FieldRow
          label="Date of Birth"
          source={profile.sources.dateOfBirth}
          canClear={profile.dateOfBirth !== null}
          onClear={() => void setManual('dateOfBirth', null)}>
          <DateField value={profile.dateOfBirth} onCommit={(value) => void setManual('dateOfBirth', value)} />
        </FieldRow>

        <View style={styles.divider} />

        <FieldRow
          label="Weight"
          source={profile.sources.weightKg}
          canClear={profile.weightKg !== null}
          onClear={() => void setManual('weightKg', null)}>
          <NumericField
            value={profile.weightKg}
            suffix="kg"
            placeholder="e.g. 75"
            onCommit={(value) => void setManual('weightKg', value)}
          />
        </FieldRow>

        <View style={styles.divider} />

        <FieldRow
          label="Height"
          source={profile.sources.heightCm}
          canClear={profile.heightCm !== null}
          onClear={() => void setManual('heightCm', null)}>
          <NumericField
            value={profile.heightCm}
            suffix="cm"
            placeholder="e.g. 178"
            onCommit={(value) => void setManual('heightCm', value)}
          />
        </FieldRow>
      </SectionCard>

      <SectionCard title="How this is used">
        <Text style={styles.helperText}>
          With a Bluetooth heart-rate strap and no Apple Watch, the app uses Sex, Date of Birth, and Weight to compute
          calories from your heart rate (the Keytel formula) — meaningfully more accurate than power-based estimation.
          Height enables the Mifflin–St Jeor basal fallback for the Apple Health Resting calorie figure.
        </Text>
        <Text style={styles.helperText}>
          Manual edits stay until you tap Clear or trigger a Sync from a provider — providers always win when you ask
          for them, but they only overwrite fields they actually return.
        </Text>
        {isEmpty ? null : (
          <ActionButton
            label="Clear All Fields"
            variant="danger"
            onPress={async () => {
              await setManual('sex', null);
              await setManual('dateOfBirth', null);
              await setManual('weightKg', null);
              await setManual('heightCm', null);
            }}
          />
        )}
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: palette.primarySubtle,
  },
  sourceBadgeText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surfaceMuted,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  inputSuffix: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: palette.surfaceMuted,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textMuted,
  },
  segmentLabelSelected: {
    color: palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonPressed: {
    opacity: 0.6,
  },
  clearButtonText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  syncButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncSuccessText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  syncErrorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
