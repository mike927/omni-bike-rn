import { useSavedGearStore } from '../../../store/savedGearStore';

export function useSavedGear() {
  const savedBike = useSavedGearStore((s) => s.savedBike);
  const savedHrSource = useSavedGearStore((s) => s.savedHrSource);
  const hydrated = useSavedGearStore((s) => s.hydrated);
  const removeBike = useSavedGearStore((s) => s.removeBike);
  const removeHr = useSavedGearStore((s) => s.removeHr);

  return {
    savedBike,
    savedHrSource,
    hydrated,
    forgetBike: removeBike,
    forgetHr: removeHr,
  };
}
