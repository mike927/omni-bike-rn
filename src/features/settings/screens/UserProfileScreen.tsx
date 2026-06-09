import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';
import { loadProfileFromAppleHealth } from '../../../services/health/appleHealthAdapter';
import { loadProfileFromStrava } from '../../../services/strava/stravaProfileService';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import { useUserProfileStore } from '../../../store/userProfileStore';
import type { BiologicalSex, ProfileFieldSource } from '../../../types/userProfile';
import { AthleteHeroCard } from '../components/AthleteHeroCard';
import { deriveProfileView } from './userProfileViewModel';
import { isAppleHealthSupported } from '../../../services/health/isAppleHealthSupported';

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
  readonly label: string;
  readonly value: number | null;
  readonly suffix: string;
  readonly placeholder: string;
  readonly onCommit: (value: number | null) => void;
}

function NumericField({ label, value, suffix, placeholder, onCommit }: NumericFieldProps) {
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value === null ? '' : String(value));
    // A committed change (Clear, Clear All, or a provider sync) supersedes any
    // pending validation error on the now-updated field.
    setError(null);
  }, [value]);

  const handleChange = (next: string) => {
    if (error) setError(null);
    setDraft(next);
  };

  const handleBlur = () => {
    const parsed = parseFiniteNumber(draft);
    // Blur never clears the field — only the explicit Clear button does. Empty or
    // invalid drafts revert to the last committed value so a stray tap mid-edit can't
    // wipe a saved number; a non-empty *invalid* entry also surfaces a hint so the user
    // knows their input was rejected rather than silently dropped.
    if (parsed === null) {
      if (draft.trim().length > 0) setError(`Enter a valid ${label.toLowerCase()} in ${suffix}.`);
      setDraft(value === null ? '' : String(value));
      return;
    }
    setError(null);
    setDraft(String(parsed));
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <View>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={noir.ink3}
          accessibilityLabel={label}
          style={styles.input}
        />
        <Text style={styles.inputSuffix}>{suffix}</Text>
      </View>
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface DateFieldProps {
  readonly label: string;
  readonly value: string | null;
  readonly onCommit: (value: string | null) => void;
}

function DateField({ label, value, onCommit }: DateFieldProps) {
  const [draft, setDraft] = useState<string>(value ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value ?? '');
    // A committed change (Clear, Clear All, or a provider sync) supersedes any
    // pending validation error on the now-updated field.
    setError(null);
  }, [value]);

  const handleChange = (next: string) => {
    if (error) setError(null);
    setDraft(next);
  };

  const handleBlur = () => {
    const parsed = parseDateInput(draft);
    // Blur never clears the field — only the explicit Clear button does. An empty or
    // partially-typed date reverts to the last committed value so a stray tap mid-edit
    // can't silently wipe a saved DOB; a non-empty *invalid* entry surfaces a hint.
    if (parsed === null) {
      if (draft.trim().length > 0) setError('Use the date format yyyy-mm-dd.');
      setDraft(value ?? '');
      return;
    }
    setError(null);
    setDraft(parsed);
    if (parsed === value) return;
    onCommit(parsed);
  };

  return (
    <View>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          value={draft}
          onChangeText={handleChange}
          onBlur={handleBlur}
          keyboardType="numbers-and-punctuation"
          placeholder="yyyy-mm-dd"
          placeholderTextColor={noir.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          style={styles.input}
        />
      </View>
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing'; source: 'apple-health' | 'strava' }
  | { kind: 'success'; source: 'apple-health' | 'strava'; fieldCount: number }
  | { kind: 'error'; source: 'apple-health' | 'strava'; message: string };

export function UserProfileScreen() {
  const router = useRouter();
  const profile = useUserProfileStore((s) => s.profile);
  const setManual = useUserProfileStore((s) => s.setManual);
  const applyProviderSync = useUserProfileStore((s) => s.applyProviderSync);
  const appleHealthConnected = useAppleHealthConnectionStore((s) => s.connected);
  const stravaConnected = useStravaConnectionStore((s) => s.connected);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'idle' });
  const appleHealthSupported = isAppleHealthSupported();

  const isEmpty = useMemo(
    () =>
      profile.sex === null && profile.dateOfBirth === null && profile.weightKg === null && profile.heightCm === null,
    [profile.sex, profile.dateOfBirth, profile.weightKg, profile.heightCm],
  );
  const noProviderConnected = (appleHealthSupported ? !appleHealthConnected : true) && !stravaConnected;

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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <Ionicons name="chevron-back" size={22} color={noir.ink2} />
        </Pressable>
        <Text style={styles.headerTitle}>User Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text style={styles.intro}>Used for accurate calorie estimation when training without an Apple Watch.</Text>

          <AthleteHeroCard vm={deriveProfileView(profile, Date.now())} />

          <Text style={styles.sectionLabel}>Sync from a provider</Text>
          <View style={styles.card}>
            {noProviderConnected ? (
              <Text style={styles.helperText}>
                {appleHealthSupported
                  ? 'Connect Apple Health or Strava in Settings to sync your profile, or fill in the fields below manually.'
                  : 'Connect Strava in Settings to sync your profile, or fill in the fields below manually.'}
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Tap a provider to overwrite your profile fields with the latest values. Fields the provider doesn&apos;t
                return are left untouched.
              </Text>
            )}
            <View style={styles.syncButtonRow}>
              {appleHealthSupported ? (
                <ActionButton
                  label={
                    syncStatus.kind === 'syncing' && syncStatus.source === 'apple-health'
                      ? 'Syncing…'
                      : 'Sync from Apple Health'
                  }
                  scheme="noir"
                  variant="secondary"
                  disabled={!appleHealthConnected || syncStatus.kind === 'syncing'}
                  onPress={handleSyncFromAppleHealth}
                />
              ) : null}
              <ActionButton
                label={
                  syncStatus.kind === 'syncing' && syncStatus.source === 'strava' ? 'Syncing…' : 'Sync from Strava'
                }
                scheme="noir"
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
          </View>

          <Text style={styles.sectionLabel}>Personal</Text>
          <View style={styles.card}>
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
              <DateField
                label="Date of Birth"
                value={profile.dateOfBirth}
                onCommit={(value) => void setManual('dateOfBirth', value)}
              />
            </FieldRow>

            <View style={styles.divider} />

            <FieldRow
              label="Weight"
              source={profile.sources.weightKg}
              canClear={profile.weightKg !== null}
              onClear={() => void setManual('weightKg', null)}>
              <NumericField
                label="Weight"
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
                label="Height"
                value={profile.heightCm}
                suffix="cm"
                placeholder="e.g. 178"
                onCommit={(value) => void setManual('heightCm', value)}
              />
            </FieldRow>
          </View>

          <Text style={styles.sectionLabel}>How this is used</Text>
          <View style={styles.card}>
            <Text style={styles.helperText}>
              With a Bluetooth heart-rate strap and no Apple Watch, the app uses Sex, Date of Birth, and Weight to
              compute calories from your heart rate (the Keytel formula) — meaningfully more accurate than power-based
              estimation. Height enables the Mifflin–St Jeor basal fallback for the Apple Health Resting calorie figure.
            </Text>
            <Text style={styles.helperText}>
              Manual edits stay until you tap Clear or trigger a Sync from a provider — providers always win when you
              ask for them, but they only overwrite fields they actually return.
            </Text>
            {isEmpty ? null : (
              <ActionButton
                label="Clear All Fields"
                scheme="noir"
                variant="danger"
                onPress={async () => {
                  await setManual('sex', null);
                  await setManual('dateOfBirth', null);
                  await setManual('weightKg', null);
                  await setManual('heightCm', null);
                }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
  },
  backBtnPressed: { opacity: 0.6 },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { color: noir.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  content: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 32 },
  intro: { color: noir.ink2, fontSize: 13.5, lineHeight: 20, marginBottom: 16, marginHorizontal: 2 },
  sectionLabel: { color: noir.ink, fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 10, marginLeft: 4 },
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  fieldRow: {
    gap: 8,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: noir.ink3,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(86,99,255,0.14)',
  },
  sourceBadgeText: {
    color: noir.indigoText,
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: noir.card3,
  },
  inputRowError: {
    borderColor: noir.danger,
  },
  fieldError: {
    color: noir.dangerSoft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    color: noir.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  inputSuffix: {
    color: noir.ink3,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: noir.card3,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: noir.indigo,
    borderWidth: 1,
    borderColor: noir.indigo,
  },
  segmentPressed: {
    opacity: 0.7,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: noir.ink2,
  },
  segmentLabelSelected: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: noir.hairline,
  },
  clearButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonPressed: {
    opacity: 0.6,
  },
  clearButtonText: {
    color: noir.dangerSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    color: noir.ink2,
    fontSize: 13,
    lineHeight: 20,
  },
  syncButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncSuccessText: {
    color: noir.mintSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  syncErrorText: {
    color: noir.dangerSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
