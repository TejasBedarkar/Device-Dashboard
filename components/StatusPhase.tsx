
import React from 'react';
import { AppState } from '../types';

interface StatusPhaseProps {
  state: AppState;
}

const StatusPhase: React.FC<StatusPhaseProps> = ({ state }) => {
  const steps = [
    { id: AppState.INITIALIZING, label: 'INIT' },
    { id: AppState.SCANNING, label: 'SCANNING' },
    { id: AppState.ACTIVE, label: 'ASSISTANT' }, // Merged dashboard into active conceptually for the pill view or keep simplistic
  ];

  // To handle the Dashboard state in the UI pills without breaking layout, we map DASHBOARD to look like SCANNING is done and we are transitioning to Active
  // Or we can just map DASHBOARD to ACTIVE for the visual indicator if we want 3 steps.
  // Let's map DASHBOARD to trigger the middle or final state.
  
  const getStepStatus = (stepId: AppState) => {
    const stateOrder = [AppState.IDLE, AppState.INITIALIZING, AppState.SCANNING, AppState.DASHBOARD, AppState.ACTIVE];
    const currentIndex = stateOrder.indexOf(state);
    const stepIndex = stateOrder.indexOf(stepId);
    
    // Treat DASHBOARD as effectively completing SCANNING and starting ACTIVE visually
    if (state === AppState.DASHBOARD && stepId === AppState.SCANNING) return 'completed';
    if (state === AppState.DASHBOARD && stepId === AppState.ACTIVE) return 'active';

    if (currentIndex === stepIndex) return 'active';
    if (currentIndex > stepIndex) return 'completed';
    return 'pending';
  };

  return (
    <div className="flex space-x-2 mb-8">
      {steps.map((step) => {
        const status = getStepStatus(step.id);
        
        let styleClass = 'bg-gray-800 text-gray-500 border-gray-700';
        let pulse = false;

        if (status === 'active') {
          styleClass = 'bg-cyan-900/30 text-cyan-400 border-cyan-500';
          pulse = true;
        } else if (status === 'completed') {
          styleClass = 'bg-cyan-900/10 text-green-400 border-green-900';
        }

        return (
          <div
            key={step.id}
            className={`flex items-center px-3 py-1 rounded-full text-xs font-space border ${styleClass} transition-all duration-500`}
          >
            {pulse && <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse mr-2"></span>}
            {status === 'completed' && (
              <svg className="w-3 h-3 mr-2 fill-current" viewBox="0 0 20 20">
                <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
              </svg>
            )}
            {step.label}
          </div>
        );
      })}
    </div>
  );
};

export default StatusPhase;
