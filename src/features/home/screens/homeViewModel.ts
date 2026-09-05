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

  // TrainingPhase.Finished falls through to the Start/Setup logic below, so Home
  // shows the ordinary Start hero for it. That is right in the common case, where
  // Finished is transient: a successful `finishAndDisconnect()` tears the ride
  // down and resets the phase to Idle before Home is looked at again.
  //
  // It is NOT always transient. When the ride's durable write fails (audit A02)
  // the phase stays Finished for as long as the unsaved ride sits in memory, and
  // Home then offers an enabled "Start Ride" over a ride that is not on disk.
  // Nothing is lost by that: the hero only routes to /training, where the recovery
  // notice offers Retry Save or Discard Ride, and `startSession()` self-guards on
  // `phase !== Idle` so the tap cannot overwrite the unsaved ride. A dedicated Home
  // state for that window is a known follow-up; read `useSessionPersistenceStore`
  // (status `unsaved`) if you add one.

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
