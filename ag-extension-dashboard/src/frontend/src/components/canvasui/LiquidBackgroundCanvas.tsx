import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Liquid } from './Liquid';

export const LiquidBackgroundCanvas: React.FC = () => {
  const { liquidEffect } = useAppStore();
  const reduceMotion = useReducedMotion();

  // Opt-in WebGL fluid canvas; never mount it under reduced motion
  // (vestibular safety + battery/GPU cost on low-end field devices).
  if (!liquidEffect || reduceMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none z-0 transition-opacity duration-700 ease-in-out"
    >
      <Liquid
        style={{ position: 'absolute', inset: 0 }}
        color={[0.03, 0.76, 0.52]}
        intensity={1.7}
        radius={0.35}
        force={1.4}
        distortion={1.1}
        blend={0.65}
      >
        {null}
      </Liquid>
    </div>
  );
};

export default LiquidBackgroundCanvas;
