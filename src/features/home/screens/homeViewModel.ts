import { TrainingPhase } from '../../../types/training';

const TRAINING_ROUTE = '/training';
const GEAR_SETUP_ROUTE = '/gear-setup';

export interface RideHeroInput {
  readonly phase: TrainingPhase;
  readonly hasSavedBike: boolean;
  readonly bikeConnected: boolean;
  readonly reconnecting: boolean;
  readonly bikeName: string | null;
  readonly hrName: string | null;
}

export interface RideHeroModel {
  readonly variant: 'primary' | 'setup';
  readonly kicker: string;
  readonly title: string;
  readonly subline: string;
  readonly disabled: boolean;
  readonly route: string | null;
}

function gearSubline(bikeName: string | null, hrName: string | null): string {
  return [bikeName, hrName].filter(Boolean).join(' · ');
}

export function deriveRideHero(input: RideHeroInput): RideHeroModel {
  const { phase, hasSavedBike, bikeConnected, reconnecting, bikeName, hrName } = input;

  if (phase === TrainingPhase.Active || phase === TrainingPhase.Paused) {
    return {
      variant: 'primary',
      kicker: 'Pick up where you left off',
      title: 'Resume Ride',
      subline: gearSubline(bikeName, hrName),
      disabled: false,
      route: TRAINING_ROUTE,
    };
  }

  // TrainingPhase.Finished is transient — `finishAndDisconnect()` navigates away
  // and resets the phase to Idle, and `session.start()` self-guards on `phase !== Idle`.
  // We intentionally let it fall through to the Start/Setup logic below rather than
  // adding a flash of a dedicated Finished state.

  if (!hasSavedBike) {
    return {
      variant: 'setup',
      kicker: 'Get started',
      title: 'Set up your Smart Bike',
      subline: 'Connect an FTMS trainer to ride',
      disabled: false,
      route: GEAR_SETUP_ROUTE,
    };
  }

  if (!bikeConnected) {
    return {
      variant: 'primary',
      kicker: reconnecting ? 'Connecting…' : 'Almost ready',
      title: 'Start Ride',
      subline: reconnecting ? `Reconnecting ${bikeName ?? 'your bike'}…` : `${bikeName ?? 'Your bike'} not connected`,
      disabled: true,
      route: null,
    };
  }

  return {
    variant: 'primary',
    kicker: 'Ready when you are',
    title: 'Start Ride',
    subline: gearSubline(bikeName, hrName),
    disabled: false,
    route: TRAINING_ROUTE,
  };
}

export interface HeaderInput {
  readonly hasSavedBike: boolean;
  readonly bikeConnected: boolean;
}

export interface HeaderModel {
  readonly greeting: string;
  readonly subline: string;
}

export function deriveHeader({ hasSavedBike, bikeConnected }: HeaderInput): HeaderModel {
  if (!hasSavedBike) {
    return { greeting: "Let's get set up", subline: 'Pair your Smart Bike to start your first ride.' };
  }
  if (bikeConnected) {
    return { greeting: 'Ready to ride?', subline: 'Your gear is linked and ready.' };
  }
  return { greeting: 'Ready to ride?', subline: 'Reconnecting your saved gear…' };
}
