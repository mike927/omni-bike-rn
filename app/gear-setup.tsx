import { useLocalSearchParams } from 'expo-router';

import { GearSetupScreen } from '../src/features/gear/screens/GearSetupScreen';
import type { GearType } from '../src/types/gear';

export default function GearSetupRoute() {
  const { target } = useLocalSearchParams<{ target: GearType }>();
  return <GearSetupScreen target={target ?? 'bike'} />;
}
