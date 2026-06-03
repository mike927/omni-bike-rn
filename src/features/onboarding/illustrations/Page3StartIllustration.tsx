import { OnboardingHero } from '../components/OnboardingHero';
import { PlayIcon } from './icons/PlayIcon';

interface Page3StartIllustrationProps {
  readonly testID?: string;
}

export function Page3StartIllustration({ testID }: Page3StartIllustrationProps) {
  return (
    <OnboardingHero testID={testID}>
      <PlayIcon />
    </OnboardingHero>
  );
}
