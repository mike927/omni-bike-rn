import type { ProviderGearSummary } from '../../types/providerGear';

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreNameMatch(localName: string, providerName: string): number {
  const normalizedLocal = normalizeName(localName);
  const normalizedProvider = normalizeName(providerName);

  if (!normalizedLocal || !normalizedProvider) {
    return 0;
  }

  if (normalizedLocal === normalizedProvider) {
    return 3;
  }

  if (normalizedLocal.includes(normalizedProvider) || normalizedProvider.includes(normalizedLocal)) {
    return 2;
  }

  const localTokens = normalizedLocal.split(' ');
  const providerTokens = new Set(normalizedProvider.split(' '));
  const sharedTokens = localTokens.filter((token) => token.length > 2 && providerTokens.has(token));

  return sharedTokens.length >= 2 ? 1 : 0;
}

export function listPotentialProviderGearMatches(
  localGearName: string,
  gear: ProviderGearSummary[],
): ProviderGearSummary[] {
  const scoredGear = gear
    .map((item) => ({ item, score: scoreNameMatch(localGearName, item.name) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredGear.map(({ item }) => item);
}
