import { OnboardingHero } from '../components/OnboardingHero';
import { HeartRateIcon } from './icons/HeartRateIcon';

interface Page2HrIllustrationProps {
  readonly testID?: string;
}

export function Page2HrIllustration({ testID }: Page2HrIllustrationProps) {
  return (
    <OnboardingHero testID={testID}>
      <HeartRateIcon />
    </OnboardingHero>
  );
}
