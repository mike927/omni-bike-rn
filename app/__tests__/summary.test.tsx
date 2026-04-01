import {
  POST_FINISH_TRAINING_SUMMARY_SOURCE,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
  shouldShowSummaryHeaderBack,
} from '../../src/features/training/navigation/trainingSummaryRoute';

describe('SummaryRoute header back visibility', () => {
  it('hides the header back button right after finishing a workout', () => {
    expect(shouldShowSummaryHeaderBack(POST_FINISH_TRAINING_SUMMARY_SOURCE)).toBe(false);
  });

  it('shows the header back button when viewing an already saved workout', () => {
    expect(shouldShowSummaryHeaderBack(SAVED_SESSION_TRAINING_SUMMARY_SOURCE)).toBe(true);
  });
});
