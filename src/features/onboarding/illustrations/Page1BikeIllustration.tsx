import { OnboardingHero } from '../components/OnboardingHero';
import { BikeIcon } from './icons/BikeIcon';

interface Page1BikeIllustrationProps {
  readonly testID?: string;
}

export function Page1BikeIllustration({ testID }: Page1BikeIllustrationProps) {
  return (
    <OnboardingHero testID={testID}>
      <BikeIcon />
    </OnboardingHero>
  );
}
