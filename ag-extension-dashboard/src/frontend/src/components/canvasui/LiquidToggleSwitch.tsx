import React from 'react';

interface LiquidToggleSwitchProps {
  className?: string;
  compact?: boolean;
}

export const LiquidToggleSwitch: React.FC<LiquidToggleSwitchProps> = () => {
  // Deactivated per QA v1 (#4, #12): liquid WebGL canvas effect is disabled
  // to avoid confusing users, battery drain, and invisible-button issues in light mode.
  return null;
};

export default LiquidToggleSwitch;
