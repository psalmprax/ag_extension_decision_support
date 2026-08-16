import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface LuminousForceFieldProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string; // Emerald default #10b981
  borderWidth?: number;
}

export const LuminousForceField: React.FC<LuminousForceFieldProps> = ({
  children,
  className = '',
  glowColor = '#10b981',
  borderWidth = 2,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative p-[1px] rounded-2xl overflow-hidden group ${className}`}
    >
      {/* Reactive Luminous Force Field Glow Layer */}
      <motion.div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 rounded-2xl"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}60, transparent 70%)`,
        }}
      />

      {/* Reactive Border Edge */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          padding: borderWidth,
          background: isHovered
            ? `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 60%)`
            : 'transparent',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Inner Container */}
      <div className="relative z-10 w-full h-full rounded-[calc(1rem-1px)] bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
};

export default LuminousForceField;
