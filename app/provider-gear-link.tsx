import { useLocalSearchParams } from 'expo-router';

import { ProviderGearLinkScreen } from '../src/features/integrations/screens/ProviderGearLinkScreen';

export default function ProviderGearLinkRoute() {
  const { provider } = useLocalSearchParams<{ provider?: string }>();

  return <ProviderGearLinkScreen providerId={provider ?? 'strava'} />;
}
