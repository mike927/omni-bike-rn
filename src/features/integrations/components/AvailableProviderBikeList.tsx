import { StyleSheet, Text, View } from 'react-native';

import type { ProviderGearSummary } from '../../../types/providerGear';
import { noir } from '../../../ui/theme';
import { providerBikeMetaLabel } from '../screens/providerGearLinkViewModel';
import { ProviderBikeRow } from './ProviderBikeRow';

interface AvailableProviderBikeListProps {
  readonly savedBikeName: string;
  readonly availableGear: readonly ProviderGearSummary[];
  readonly potentialMatchIds: ReadonlySet<string>;
  readonly selectedGearId: string | null;
  readonly hasPotentialMatches: boolean;
  readonly onSelect: (gearId: string) => void;
}

/** The "Available Provider Bikes" garage list: helper line + tap-to-select rows. */
export function AvailableProviderBikeList({
  savedBikeName,
  availableGear,
  potentialMatchIds,
  selectedGearId,
  hasPotentialMatches,
  onSelect,
}: Readonly<AvailableProviderBikeListProps>) {
  return (
    <View style={styles.listSection}>
      <Text style={styles.sectionLabel}>Available Provider Bikes</Text>
      {hasPotentialMatches ? (
        <Text style={styles.helperText}>
          Possible matches for {savedBikeName} are labeled below. You can still choose any provider bike.
        </Text>
      ) : null}
      <View style={styles.list}>
        {availableGear.map((gear) => {
          const isMatch = potentialMatchIds.has(gear.id);
          return (
            <ProviderBikeRow
              key={gear.id}
              name={gear.name}
              meta={providerBikeMetaLabel(gear, isMatch)}
              selected={selectedGearId === gear.id}
              isMatch={isMatch}
              onPress={() => onSelect(gear.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listSection: { marginBottom: 14 },
  sectionLabel: { color: noir.ink, fontSize: 14, fontWeight: '700', marginBottom: 10, marginLeft: 4 },
  helperText: { color: noir.ink2, fontSize: 13, lineHeight: 19, marginBottom: 12, marginLeft: 4 },
  list: { gap: 10 },
});
