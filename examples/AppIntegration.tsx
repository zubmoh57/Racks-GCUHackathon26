import type { ActionImpact, PlannerState } from '../features/planning/types.ts';
import { PlanningPanel } from '../features/planning/PlanningPanel.tsx';

/** Connects an existing application store to the standalone planning feature. */
export function PlanningIntegrationSlot(props: {
  planning: PlannerState;
  updatePlanning: (next: PlannerState) => void;
  selectedActionEstimates: readonly ActionImpact[];
  resetToken: number;
}) {
  return <PlanningPanel
    value={props.planning}
    onChange={props.updatePlanning}
    acceptedActionImpacts={props.selectedActionEstimates}
    resetKey={props.resetToken}
    allowIllustration
  />;
}
